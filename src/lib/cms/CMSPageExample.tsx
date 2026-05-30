// Example: How to use CMS content in your pages
// This file shows the pattern for integrating CMS with Next.js pages

import { cmsDb } from '@adminpanel/lib/cms/database';

export default async function CMSPage({ params }: { params: { slug: string } }) {
  // Fetch page content from CMS
  const page = await cmsDb.getPage(`/${params.slug}`);

  if (!page || page.status !== 'published') {
    return <div>Page not found</div>;
  }

  return (
    <div className="min-h-screen">
      {page.blocks.map((block) => {
        switch (block.type) {
          case 'hero':
            return (
              <section key={block.id} className="hero-section py-20 text-center">
                <div className="container-custom">
                  <h1 className="heading-2xl text-gradient mb-4">{(block as any).props?.title}</h1>
                  <p className="text-xl text-text-secondary mb-8">{(block as any).props?.subtitle}</p>
                  {(block as any).props?.cta && (
                    <a href={(block as any).props.cta.url} className="btn-primary">
                      {(block as any).props.cta.text}
                    </a>
                  )}
                </div>
              </section>
            );

          case 'heading':
            const HeadingTag = `h${(block as any).props?.level || 2}` as keyof React.JSX.IntrinsicElements;
            return (
              <HeadingTag
                key={block.id}
                className={`font-bold text-gradient ${
                  (block as any).props?.align === 'center' ? 'text-center' :
                  (block as any).props?.align === 'right' ? 'text-right' : ''
                }`}
              >
                {(block as any).props?.text}
              </HeadingTag>
            );

          case 'paragraph':
            return (
              <p
                key={block.id}
                className={`text-text-secondary my-4 ${
                  (block as any).props?.align === 'center' ? 'text-center' :
                  (block as any).props?.align === 'right' ? 'text-right' : ''
                }`}
              >
                {(block as any).props?.text}
              </p>
            );

          case 'image':
            return (
              <div key={block.id} className={`my-6 ${
                (block as any).props?.align === 'center' ? 'text-center' :
                (block as any).props?.align === 'right' ? 'text-right' : ''
              }`}>
                <img src={(block as any).props?.url} alt={(block as any).props?.alt || ""} className="rounded" />
              </div>
            );

          case 'button':
            return (
              <div key={block.id} className={`my-6 ${
                (block as any).props?.align === 'center' ? 'text-center' :
                (block as any).props?.align === 'right' ? 'text-right' : ''
              }`}>
                <a href={(block as any).props?.url} className="btn-primary">
                  {(block as any).props?.text}
                </a>
              </div>
            );

          case 'testimonial':
            return (
              <blockquote key={block.id} className="card-cyber p-6 my-8 border-l-4 border-cyber-green">
                <p className="text-text-primary italic mb-4">"{(block as any).props?.quote}"</p>
                <footer className="text-text-secondary text-sm">
                  <strong>{(block as any).props?.author}</strong> - {(block as any).props?.role}
                </footer>
              </blockquote>
            );

          case 'cards':
            return (
              <div
                key={block.id}
                className={`grid grid-cols-1 md:grid-cols-${(block as any).props?.columns || 3} gap-6 my-8`}
              >
                {((block as any).props?.cards || []).map((card: any, idx: number) => (
                  <div key={idx} className="card-cyber p-6 text-center">
                    <div className="text-4xl mb-3">{card.icon}</div>
                    <h3 className="text-xl font-bold text-gradient mb-2">{card.title}</h3>
                    <p className="text-text-secondary">{card.description}</p>
                  </div>
                ))}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

// Example usage in existing pages:
// 
// 1. For static pages (Home, About, etc.):
//    - Keep existing components
//    - Add CMS content loading
//    - Merge CMS blocks with existing layout
//
// 2. For new CMS-only pages:
//    - Use the pattern above
//    - All content comes from CMS
//
// 3. Migration strategy:
//    - Create CMS content for each page
//    - Gradually replace hardcoded content
//    - Keep important components as React components
