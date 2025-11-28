export const AVA_DEFAULT_INTRO_VIDEO_URL =
  (import.meta.env.VITE_AVA_WELCOME_VIDEO_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_AVA_INTRO_VIDEO_URL as string | undefined)?.trim() ||
  "https://vimeo.com/1088047119/e13812494c";

export const buildAvaProcessExplanationMessages = (userName: string) => [
  `<p><strong>Great to meet you, ${userName}!</strong> This isn't just profiling. This is persuasion psychology at its highest level. You're about to enter a powerful process designed to uncover the real reasons your ideal clients say yes, hesitate, or walk away. We're not just identifying traits—we're <strong>decoding buying behavior</strong> using deep psychological insight. And I'm uniquely equipped to guide you through it. I'm AVA—the <strong>Audience Values Accelerator</strong>—built through years of expert programming by my creator, who has spent over a decade mastering buyer psychology, persuasive marketing, and high-conversion messaging. Every insight I generate is powered by those frameworks, refined into a precision system you now get to use.</p><h3>Here's how it works:</h3><ol><li><strong>1. First</strong>, you'll answer a set of targeted questions to give me context on your ideal buyer.</li><li><strong>2. Then</strong>, I'll assume their perspective—completing a high-level psychological assessment that reveals their subconscious motivators, emotional triggers, fears, resistance points, and buying logic.</li><li><strong>3. Finally</strong>, I'll guide you step-by-step through building their Ideal Persuasion Profile. You'll review, refine, and approve each section—crafting a high-conversion behavioral blueprint you can apply to all your messaging, offers, and campaigns.</li></ol><h3>Why this approach is so effective:</h3><p><strong>Most strategies focus on <em>who</em> your audience is. This reveals <em>how</em> and <em>why</em> they buy.</strong> By understanding the emotional patterns, belief systems, and decision-making behaviors of your ideal buyer, you'll create content that lands with immediate relevance. When you plug these insights into VOXBOX's Amplifiers, you'll generate offers, positioning, and sales assets that speak directly to what moves your audience—and what holds them back.</p>`,
];

export const AVA_PHASE1_READY_MESSAGE =
  "<p><strong>Ready to dive deep?</strong> Let's start by gathering foundational insights about your ideal client. Please thoughtfully answer each of the following predefined questions. Your responses will directly shape the psychological depth of your final ideal client profile.</p>";

export const buildAvaFallbackIntroMessages = (userName: string) => [
  ...buildAvaProcessExplanationMessages(userName),
  AVA_PHASE1_READY_MESSAGE,
];


