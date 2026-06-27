import { randomUUID } from 'node:crypto';
import type { AiService } from '../../domain/repositories/ai-service.ts';
import type { ArticleRepository } from '../../domain/repositories/article-repository.ts';
import type { ProfileRepository } from '../../domain/repositories/profile-repository.ts';
import type { ResearchRepository } from '../../domain/repositories/research-repository.ts';
import type { Article } from '../../domain/entities/article.ts';
import type { Result } from '../../domain/entities/result.ts';
import type { LoggerPort } from '../ports/logger.ts';
import { parseJsonRecord } from './parse-ai-json.ts';

const ARTICLE_PROMPT = `You are writing an article for a specific author. Your goal is to produce text that sounds exactly like them.

Below is the author's voice profile — their stylistic traits extracted from their writing. You MUST follow these traits precisely.

Voice Profile:
- Tone: {{tone}}
- Pacing: {{pacing}}
- Storytelling: {{storytelling}}
- Vocabulary: {{vocabulary}}
- Sentence Structure: {{sentenceStructure}}
- Transitions: {{transitions}}
- Humor: {{humor}}
- Reader Engagement: {{readerEngagement}}
- Summary: {{summary}}

Write a complete article on the given topic using the provided research material. The article should:

1. Match the author's voice exactly — follow every trait above
2. Be informative and well-structured with a clear introduction, body, and conclusion
3. Incorporate insights from the research material naturally
4. Be between 800-1500 words unless the topic demands more depth

Return ONLY valid JSON with this exact structure:
{
  "title": "Article title that matches the author's style",
  "content": "Full article content in markdown format"
}`;

export class GenerateArticleUseCase {
  constructor(
    private readonly ai: AiService,
    private readonly articleRepo: ArticleRepository,
    private readonly profileRepo: ProfileRepository,
    private readonly researchRepo: ResearchRepository,
    private readonly logger: LoggerPort,
  ) {}

  async execute(params: {
    topic?: string;
    researchId?: string;
  }): Promise<Result<Article>> {
    const voiceResult = await this.profileRepo.getLatestVoiceProfile();
    if (!voiceResult.ok) return voiceResult;
    const voiceProfile = voiceResult.value;
    if (!voiceProfile) {
      return { ok: false, error: 'No voice profile found. Run `thoth profile generate` first.' };
    }

    let researchContent = '';
    let researchId: string | null = null;

    if (params.researchId) {
      const researchResult = await this.researchRepo.get(params.researchId);
      if (!researchResult.ok) return researchResult;
      if (researchResult.value) {
        researchContent = researchResult.value.content;
        researchId = researchResult.value.id;
      }
    }

    const topicSection = params.topic
      ? `\n\nTopic: ${params.topic}`
      : '';

    const researchSection = researchContent
      ? `\n\nResearch Material:\n${researchContent}`
      : '';

    const prompt = ARTICLE_PROMPT
      .replace('{{tone}}', voiceProfile.traits.tone.join(', '))
      .replace('{{pacing}}', voiceProfile.traits.pacing.join(', '))
      .replace('{{storytelling}}', voiceProfile.traits.storytelling.join(', '))
      .replace('{{vocabulary}}', voiceProfile.traits.vocabulary.join(', '))
      .replace('{{sentenceStructure}}', voiceProfile.traits.sentenceStructure.join(', '))
      .replace('{{transitions}}', voiceProfile.traits.transitions.join(', '))
      .replace('{{humor}}', voiceProfile.traits.humor.join(', '))
      .replace('{{readerEngagement}}', voiceProfile.traits.readerEngagement.join(', '))
      .replace('{{summary}}', voiceProfile.summary ?? '');

    const userMessage = `Write an article${topicSection}${researchSection}`;

    const chatResult = await this.ai.chat({
      systemPrompt: `${prompt}\n\nDo not include markdown fences, commentary, or any text outside the JSON object.`,
      userPrompt: userMessage,
      responseFormat: 'json',
      temperature: 0.7,
    });

    if (!chatResult.ok) return { ok: false, error: chatResult.error };

    const parsed = parseJsonRecord(chatResult.value);
    if (!parsed.ok) return { ok: false, error: `Invalid JSON response from article generation AI: ${parsed.error}` };

    if (typeof parsed.value.title !== 'string' || typeof parsed.value.content !== 'string') {
      return { ok: false, error: 'Article response missing title or content' };
    }

    const title: string = parsed.value.title;
    const content: string = parsed.value.content;
    const wordCount = content.split(/\s+/).length;

    const article: Article = {
      id: randomUUID(),
      title,
      content,
      voiceProfileId: voiceProfile.id,
      researchId,
      wordCount,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const saveResult = await this.articleRepo.save(article);
    if (!saveResult.ok) return saveResult;

    this.logger.info({ articleId: article.id, title: article.title, wordCount }, 'Article generated');
    return { ok: true, value: article };
  }
}
