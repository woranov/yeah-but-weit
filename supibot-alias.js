// noinspection DuplicatedCode
(() => {
  const pathSegments = [];
  const querySegments = [];
  // noinspection JSUnresolvedVariable
  for (const arg of args) {
    arg.includes(':')
      ? querySegments.push(arg.replace(':', '='))
      : pathSegments.push(
        arg.startsWith("#")
          ? "list/" + arg.substr(1)
          : arg
      );
  }

  return (
    // base url
    ['https://e.wrnv.xyz', ...pathSegments].join('/')
    // add query string
    + (querySegments.length && '?' + querySegments.join('&') || '')
  );
})();
