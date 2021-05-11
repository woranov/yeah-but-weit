import { StatusError } from "../errors";
import { DEBUG } from "../config";


function applyTransformers(text: string, transformers: ((text: string) => string)[]): string {
  return transformers.reduce((currText, currTransformer) => currTransformer(currText), text);
}


const DEFAULT_FAVICON = "https://cdn.betterttv.net/emote/5e500538e383e37d5d9dd3ec/2x";


function addLinkToAtMentionTransformer(text: string): string {
  return text.replaceAll(
    /@([a-zA-Z0-9_]+)/g,
    (
      match, channelName,
    ) => `<a href='https://www.twitch.tv/${channelName.toLowerCase()}'>@${channelName}</a>`,
  );
}


function createHtml({
  favicon = DEFAULT_FAVICON,
  title,
  description = null,
  image = null,
  ogProperties = undefined,
  head = "",
  html = "",
  textTransformers = [],
}: HtmlCreateModel): string {

  if (ogProperties === undefined) {
    ogProperties = {
      title: title.text,
      description: description,
      imageUrl: image?.url,
    };
  }

  const ogPropStrings = [];

  if (ogProperties) {
    const { title, description, imageUrl } = ogProperties;
    if (title) {
      ogPropStrings.push(`<meta property='og:title' content='${title}'>`);
    }
    if (description) {
      ogPropStrings.push(`<meta property='og:description' content='${description}'>`);
    }
    if (imageUrl) {
      ogPropStrings.push(
        "<meta property='twitter:card' content='summary_large_image'>",
        `<meta property='og:image' content='${imageUrl}'>`,
      );
    }
  }

  const mainHtmlStrings = [];

  if (image) {
    mainHtmlStrings.push(`
      <a href='${image.url}' class='main-img'>
        <img class='image' src='${image.url}' alt='${image.alt}'>
      </a>
    `);
  }

  {
    let { text, url = null } = title;
    text = applyTransformers(text, textTransformers);
    mainHtmlStrings.push(
      url
        ? `<h1><a href='${url}'>${text}</a></h1>`
        : `<h1>${text}</h1>`,
    );
  }

  if (description) {
    mainHtmlStrings.push(`<p>${applyTransformers(description, textTransformers)}</p>`);
  }

  return `
    <html lang='en'>
      <head>
        <title>${title.text}</title>
        <link rel='shortcut icon' href='${favicon}'>
        <meta charset='utf-8'>
        <meta name='robots' content='noindex'>
        <meta name='viewport' content='width=device-width, minimum-scale=0.1'>
        <meta name='color-scheme' content='dark'>
        ${ogPropStrings.join("\n")}
        <style>
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            background: #04040a;
            font-family: sans-serif;
            color: whitesmoke;
          }
          a {
            color: cornflowerblue;
          }
          main {
            text-align: center;
            margin-top: 30vh;
          }
          main p {
            margin-bottom: calc(1rem + 5vh);
          }
          main p:last-child {
            margin-bottom: 0;
          }
          main .main-img {
            display: inline-block;
            cursor: zoom-in;
          }
          main > h1, main > p {
            display: block;
            text-align: center;
          }
          main > p a {
            text-decoration: none;
            font-weight: bold;
          }
          main ul {
            padding: 0;
            list-style-type: none;
          }
          main ul li {
            display: inline-block;
            padding: 0.1rem;
            max-width: 4rem;
          }
          main ul li img {
            max-width: 100%;
          }
        </style>
        ${head}
      </head>
      <body>
        <main>
          ${mainHtmlStrings.join("\n")}
          ${html}
        </main>
      </body>
    </html>
  `;
}


function makeServerErrorHtml(status: number, description?: string): string {
  return createHtml({
    title: {
      text: status.toString(),
    },
    description: description,
    image: {
      url: "https://cdn.betterttv.net/emote/5ad22a7096065b6c6bddf7f3/3x",
      alt: "WAYTOODANK",
    },
  });
}


const NOT_FOUND_HTML = createHtml({
  title: {
    text: "404",
  },
  image: {
    url: "https://cdn.betterttv.net/emote/603ad0ce7c74605395f35949/3x",
    alt: "ppLurking",
  },
});

const OK_DONE_HTML = createHtml({
  title: {
    text: "DUN",
  },
  image: {
    url: "https://cdn.frankerfacez.com/emote/438696/4",
    alt: "Okayeg",
  },
});

const UNAUTHORIZED_HTML = createHtml({
  title: {
    text: "401",
  },
  image: {
    url: "https://cdn.betterttv.net/emote/5f10cdc819a5bd0524ecc8f7/3x",
    alt: "NOIDONTTHINKSO",
  },
  description: "Unauthorized",
});


function notFoundHandler() {
  return new Response(NOT_FOUND_HTML, {
    status: 404,
    headers: { "Content-type": "text/html" },
  });
}


function errorHandler(error: StatusError) {
  return new Response(
    makeServerErrorHtml(error.status || 500, (DEBUG ? error.message : null) || "Server Error"),
    {
      status: error.status || 500,
      headers: { "Content-type": "text/html" },
    },
  );
}


function okHandler() {
  return new Response(OK_DONE_HTML, {
    status: 200,
    headers: { "Content-type": "text/html" },
  });
}


function unauthorizedHandler() {
  return new Response(UNAUTHORIZED_HTML, {
    status: 401,
    headers: { "Content-type": "text/html" },
  });
}


export {
  addLinkToAtMentionTransformer, createHtml, notFoundHandler, errorHandler, okHandler, unauthorizedHandler,
};
