import { revalidatePath } from 'next/cache';

// The admin panel is embedded into each host site as a git submodule, so it
// runs inside that site's Next.js process. That means we can revalidate the
// site's prerendered cache directly, in-process — no cross-app webhook needed.

export function revalidateAllPublic() {
  try {
    revalidatePath('/', 'layout');
  } catch (e) {
    console.error('revalidateAllPublic failed', e);
  }
}

export function revalidatePageBySlug(slug?: string | null) {
  if (!slug) {
    revalidateAllPublic();
    return;
  }
  try {
    const normalized = slug === '/' ? '/' : `/${slug.replace(/^\/+/, '')}`;
    revalidatePath(normalized);
  } catch (e) {
    console.error('revalidatePageBySlug failed', e);
  }
}
