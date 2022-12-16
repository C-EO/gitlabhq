import * as Sentry from '@sentry/browser';
import { helpPagePath } from '~/helpers/help_page_helper';
import axios from '~/lib/utils/axios_utils';

export const splitDocument = (htmlString) => {
  const htmlDocument = new DOMParser().parseFromString(htmlString, 'text/html');
  const title = htmlDocument.querySelector('h1')?.innerText;
  htmlDocument.querySelector('h1')?.remove();
  return {
    title,
    body: htmlDocument.querySelector('body').innerHTML.toString(),
  };
};

export const getRenderedMarkdown = (documentPath) => {
  return axios
    .get(helpPagePath(documentPath))
    .then(({ data }) => {
      const { body, title } = splitDocument(data);
      return {
        body,
        title,
        hasFetchError: false,
      };
    })
    .catch((e) => {
      Sentry.captureException(e);
      return {
        hasFetchError: true,
      };
    });
};
