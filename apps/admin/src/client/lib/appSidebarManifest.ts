export interface AppSidebarJson5Item {
  id: string;
  label: string;
  path: string;
}

export interface AppSidebarJson5Section {
  id: string;
  title: string;
  items: AppSidebarJson5Item[];
}

export interface AppSidebarJson5Manifest {
  sections: AppSidebarJson5Section[];
}

export interface RenderedAppSidebarItem {
  id: string;
  label: string;
  href: string;
}

/**
 * Convert a user App's sidebar.json5 manifest into shell nav items. The labels
 * and paths come from the manifest; core may wrap them, but must not substitute
 * hardcoded PeopleClaw navigation for the user App sidebar.
 */
export function renderAppSidebarFromManifest(appId: string, sidebar: AppSidebarJson5Manifest): RenderedAppSidebarItem[] {
  return sidebar.sections.flatMap(section =>
    section.items.map(item => ({
      id: `${section.id}:${item.id}`,
      label: item.label,
      href: `/apps/${encodeURIComponent(appId)}${item.path.startsWith('/') ? item.path : `/${item.path}`}`,
    })),
  );
}
