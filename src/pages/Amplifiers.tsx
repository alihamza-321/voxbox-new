import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Monitor,
  Video,
  Megaphone,
  FileText,
  PenTool,
  Newspaper,
  BookMarked,
  Layers,
} from 'lucide-react';

import { Card, CardDescription, CardTitle } from '@/components/ui/card';

interface AmplifierCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  isAvailable: boolean;
  link?: string;
}

const amplifierCards: AmplifierCard[] = [
  {
    id: 'email_sequence',
    title: 'Email Sequence',
    description: 'Craft persuasive email campaigns',
    icon: <Sparkles className="h-5 w-5 text-white" />,
    accent: 'bg-black',
    isAvailable: true,
    link: '/amplifiers/email-sequence',
  },
  {
    id: 'social_media',
    title: 'Social Media Posts',
    description: 'Engaging social content',
    icon: <Monitor className="h-5 w-5 text-white" />,
    accent: 'bg-black',
    isAvailable: true,
    link: '/amplifiers/social-media',
  },
  {
    id: 'sales_page',
    title: 'Sales Page',
    description: 'High-converting landing pages',
    icon: <FileText className="h-5 w-5 text-white" />,
    accent: 'bg-black',
    isAvailable: true,
    link: '/amplifiers/sales-page',
  },
  {
    id: 'video_script',
    title: 'Video Script',
    description: 'Compelling video scripts',
    icon: <Video className="h-5 w-5 text-white" />,
    accent: 'bg-black',
    isAvailable: true,
    link: '/amplifiers/video-script',
  },
  {
    id: 'ad_copy',
    title: 'Ad Copy',
    description: 'Attention-grabbing ads',
    icon: <Megaphone className="h-5 w-5 text-white" />,
    accent: 'bg-black',
    isAvailable: true,
    link: '/amplifiers/ad-copy',
  },
  {
    id: 'value_proposition',
    title: 'Value Proposition',
    description: 'Clear positioning statements',
    icon: <Layers className="h-5 w-5 text-white" />,
    accent: 'bg-black',
    isAvailable: true,
    link: '/amplifiers/value-proposition',
  },
  {
    id: 'blog_post',
    title: 'Blog Post',
    description: 'SEO-optimized articles',
    icon: <Newspaper className="h-5 w-5 text-white" />,
    accent: 'bg-black',
    isAvailable: true,
    link: '/amplifiers/blog-post',
  },
  {
    id: 'webinar_script',
    title: 'Webinar Script',
    description: 'Educational presentations',
    icon: <PenTool className="h-5 w-5 text-white" />,
    accent: 'bg-black',
    isAvailable: true,
    link: '/amplifiers/webinar-script',
  },
  {
    id: 'lead_magnet',
    title: 'Lead Magnet Content',
    description: 'Valuable free resources',
    icon: <BookMarked className="h-5 w-5 text-white" />,
    accent: 'bg-black',
    isAvailable: false,
  },
  {
    id: 'case_study',
    title: 'Case Study',
    description: 'Proof-driven stories',
    icon: <Layers className="h-5 w-5 text-white" />,
    accent: 'bg-black',
    isAvailable: true,
    link: '/amplifiers/case-study',
  },
];

const Amplifiers = () => {
  const navigate = useNavigate();

  const availableAmplifiers = useMemo(() => amplifierCards, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground md:text-4xl">Content Amplifiers</h1>
        <p className="text-base text-muted-foreground">
          Transform your profiles into persuasive content across multiple formats.
        </p>
      </header>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {availableAmplifiers.map((card) => {
          const isDisabled = !card.isAvailable;

          return (
            <Card
              key={card.id}
              className={`group flex cursor-pointer items-center gap-5 rounded-2xl border border-border/60 bg-white px-6 py-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${
                isDisabled ? 'pointer-events-none opacity-60' : ''
              }`}
              onClick={() => {
                if (card.link) {
                  navigate(card.link);
                }
              }}
            >
              <div className={`${card.accent} flex h-12 w-12 items-center justify-center rounded-xl`}>
                {card.icon}
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">{card.title}</CardTitle>
                <CardDescription className="text-sm text-gray-400">
                  {card.description}
                </CardDescription>
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
};

export default Amplifiers;

