interface HtmlCreateModel {
  favicon?: string;
  title: {
    text: string;
    url?: string;
  };
  description?: string | null;
  image?: {
    url: string;
    alt: string;
  } | null;
  ogProperties?: {
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
  } | null;
  head?: string;
  html?: string;
  textTransformers?: ((text: string) => string)[];
}
