import type { PublicHero } from './public.presenter.js';

export const DEFAULT_HERO: PublicHero = {
  isDefault: true,
  heading: 'Software that moves your business forward',
  subheading: 'ZoyCoders designs and builds websites, mobile apps and APIs for growing teams.',
  primaryCta: { label: 'Get a quote', url: '/contact' },
  secondaryCta: { label: 'See our work', url: '/portfolio' },
  image: null,
};
