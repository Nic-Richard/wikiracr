function allowedOrigins(clientUrl) {
  const url = new URL(clientUrl);
  const host = url.hostname.replace(/^www\./, '');
  return [`${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`, `${url.protocol}//www.${host}${url.port ? `:${url.port}` : ''}`, 'https://localhost'];
}

module.exports = { allowedOrigins };
