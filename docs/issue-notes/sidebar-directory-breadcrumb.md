# Sidebar — Directory breadcrumb

Issue

- Add a directory-style breadcrumb in the sidebar that reflects the active path in `My Drive`.

Summary of implementation

- Added a `DriveBreadcrumbProvider` (`src/components/layout/DriveBreadcrumbContext.tsx`) that exposes shared breadcrumb state (`breadcrumbs`, `setBreadcrumbs`) and helpers for the sidebar to sync child directories (`childDirectories`, `setChildDirectories`, `childDirectoriesFolderId`).
- The sidebar (`src/components/layout/Sidebar.tsx`) now renders a collapsible directory tree under the **My Drive** nav item. The tree is lazy-loaded and cached per parent using `childrenByParent`, `hasChildrenById` and `loadingChildrenIds` to avoid redundant network requests.
- The `MyDrivePage` (`src/pages/drive/MyDrivePage.tsx`) drives the breadcrumb state on mount and when navigating into folders; it sets `breadcrumbs` to `[{ id: null, name: "My Drive" }]` on initial load and updates the trail on folder navigation.

Behavior & UX

- Clicking a breadcrumb segment navigates to that level (the page slice updates via `setBreadcrumbs`).
- In the sidebar tree, folders support expand/collapse, context menu actions (Create, Upload, Rename, Share, Delete) and file upload via a hidden input. Root click resets the breadcrumb to `My Drive`.
- Children are fetched on demand (`directoryService.fetchContents` / `fetchRoot`) and cached to `childrenByParent` to keep the sidebar snappy.

Developer notes

- Files touched / implemented:
  - `src/components/layout/DriveBreadcrumbContext.tsx` — provider + `useDriveBreadcrumbs` hook
  - `src/components/layout/Sidebar.tsx` — directory tree rendering, caching, expand/collapse, context menus
  - `src/pages/drive/MyDrivePage.tsx` — initializes breadcrumb and fetch logic, batch metadata fetch
- The implementation emits a `voyagrr:drive-refresh` event after create/rename/delete/upload actions to keep views in sync.
- Performance: `probeFolderHasChildren` runs a light probe to mark folders as having children without over-fetching; `fetchChildrenForParent` fetches and caches full lists when a node is expanded.

Follow-ups / suggestions

- Consider debouncing or rate-limiting rapid `voyagrr:drive-refresh` events if many operations fire in quick succession.
- We could add per-folder optimistic UI updates for create/delete/rename to improve perceived latency (currently the code updates local caches, which is already good).

Notes

- The implementation follows the existing repository conventions for state sharing, route handling, and folder actions.
