import { StatusError } from "../errors";
import { DEBUG } from "../config";


function createHtml({
  title,
  titleLink = null,
  description = null,
  atMentionReplacer = null,
  image,
}: {
  title: string,
  titleLink?: string | null,
  description?: string | null,
  atMentionReplacer?: ((match: string, channelName: string) => string) | null,
  image: { url: string, alt: string }
}): string {
  const h1Title = titleLink !== null
    ? `<h1><a href='${titleLink}'>${title}</a></h1>`
    : `<h1>${title}</h1>`;

  let pDescription = "";
  if (description !== null) {
    pDescription = `<p>${description}</p>`;
    if (atMentionReplacer) {
      pDescription = pDescription.replaceAll(
        /@([a-zA-Z0-9_]+)/g,
        atMentionReplacer,
      );
    }
  }

  const ogDescription = description !== null
    ? `<meta property='og:description' content='${description}'>`
    : "";

  return `
    <html lang='en'>
      <head>
        <title>${title}</title>
        <link rel='shortcut icon' href='https://cdn.betterttv.net/emote/5e500538e383e37d5d9dd3ec/2x'>
        <meta charset='utf-8'>
        <meta name='robots' content='noindex'>
        <meta name='viewport' content='width=device-width, minimum-scale=0.1'>
        <meta name='color-scheme' content='dark'>
        <meta property='twitter:card' content='summary_large_image'>
        <meta property='og:title' content='${title}'>
        <meta property='og:image' content='${image.url}'>
        ${ogDescription}
        <style>
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            background: #04040a;
            font-family: sans-serif;
          }
          body {
            display: flex;
            align-items: center;
            justify-content: center;
            color: whitesmoke;
          }
          a {
            color: cornflowerblue;
          }
          main {
            text-align: center;
          }
          main > a {
            display: inline-block;
          }
          main > h1, main > p {
            display: block;
            text-align: center;
          }
          main > a {
            cursor: zoom-in;
          }
          main > p a {
            text-decoration: none;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <main>
          <a href='${image.url}'>
            <img class='image' src='${image.url}' alt='${image.alt}'>
          </a>
          ${h1Title}
          ${pDescription}
        </main>
      </body>
    </html>
  `;
}

function makeServerErrorHtml(status: number, description?: string): string {
  return createHtml({
    title: status.toString(),
    description: description,
    image: {
      url: "https://cdn.betterttv.net/emote/5ad22a7096065b6c6bddf7f3/3x",
      alt: "WAYTOODANK",
    },
  });
}

const NOT_FOUND_HTML = createHtml({
  title: "404",
  image: {
    url: "https://cdn.betterttv.net/emote/603ad0ce7c74605395f35949/3x",
    alt: "ppLurking",
  },
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


export { createHtml, notFoundHandler, errorHandler };
