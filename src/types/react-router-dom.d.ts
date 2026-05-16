import type * as React from "react";

declare module "react-router-dom" {
  export interface NavigateProps {
    to: string;
    replace?: boolean;
    state?: unknown;
    relative?: "route" | "path";
  }

  export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    to: string;
    replace?: boolean;
    state?: unknown;
    relative?: "route" | "path";
  }

  export interface BrowserRouterProps {
    basename?: string;
    children?: React.ReactNode;
    unstable_useTransitions?: boolean;
    window?: Window;
  }

  export interface RoutesProps {
    children?: React.ReactNode;
    location?: unknown;
  }

  export interface Location<State = unknown> {
    pathname: string;
    search: string;
    hash: string;
    state: State;
    key: string;
  }

  export const BrowserRouter: React.ComponentType<BrowserRouterProps>;
  export const Routes: React.ComponentType<RoutesProps>;
  export const Route: React.ComponentType<Record<string, unknown>>;
  export const Navigate: React.ComponentType<NavigateProps>;
  export const Link: React.ForwardRefExoticComponent<
    React.PropsWithoutRef<LinkProps> & React.RefAttributes<HTMLAnchorElement>
  >;

  export function useNavigate(): (
    to: string,
    options?: {
      replace?: boolean;
      state?: unknown;
      relative?: "route" | "path";
    },
  ) => void;
  export function useLocation<State = unknown>(): Location<State>;
  export function useParams<
    T extends Record<string, string | undefined> = Record<
      string,
      string | undefined
    >,
  >(): Readonly<Partial<T>>;
}
