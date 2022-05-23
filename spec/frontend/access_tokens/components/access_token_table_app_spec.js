import { GlTable } from '@gitlab/ui';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import AccessTokenTableApp from '~/access_tokens/components/access_token_table_app.vue';
import { __, s__, sprintf } from '~/locale';
import DomElementListener from '~/vue_shared/components/dom_element_listener.vue';

describe('~/access_tokens/components/access_token_table_app', () => {
  let wrapper;

  const accessTokenType = 'personal access token';
  const accessTokenTypePlural = 'personal access tokens';
  const initialActiveAccessTokens = [];
  const noActiveTokensMessage = 'This user has no active personal access tokens.';
  const showRole = false;

  const defaultActiveAccessTokens = [
    {
      name: 'a',
      scopes: ['api'],
      created_at: '2021-05-01T00:00:00.000Z',
      last_used_at: null,
      expired: false,
      expires_soon: true,
      expires_at: null,
      revoked: false,
      revoke_path: '/-/profile/personal_access_tokens/1/revoke',
      role: 'Maintainer',
    },
    {
      name: 'b',
      scopes: ['api', 'sudo'],
      created_at: '2022-04-21T00:00:00.000Z',
      last_used_at: '2022-04-21T00:00:00.000Z',
      expired: true,
      expires_soon: false,
      expires_at: new Date().toISOString(),
      revoked: false,
      revoke_path: '/-/profile/personal_access_tokens/2/revoke',
      role: 'Maintainer',
    },
  ];

  const createComponent = (props = {}) => {
    wrapper = mount(AccessTokenTableApp, {
      provide: {
        accessTokenType,
        accessTokenTypePlural,
        initialActiveAccessTokens,
        noActiveTokensMessage,
        showRole,
        ...props,
      },
    });
  };

  const triggerSuccess = async (activeAccessTokens = defaultActiveAccessTokens) => {
    wrapper
      .findComponent(DomElementListener)
      .vm.$emit('ajax:success', { detail: [{ active_access_tokens: activeAccessTokens }] });
    await nextTick();
  };

  const findTable = () => wrapper.findComponent(GlTable);
  const findHeaders = () => findTable().findAll('th > :first-child');
  const findCells = () => findTable().findAll('td');

  afterEach(() => {
    wrapper?.destroy();
  });

  it('should render the `GlTable` with default empty message', () => {
    createComponent();

    const cells = findCells();
    expect(cells).toHaveLength(1);
    expect(cells.at(0).text()).toBe(
      sprintf(__('This user has no active %{accessTokenTypePlural}.'), { accessTokenTypePlural }),
    );
  });

  it('should render the `GlTable` with custom empty message', () => {
    const noTokensMessage = 'This group has no active access tokens.';
    createComponent({ noActiveTokensMessage: noTokensMessage });

    const cells = findCells();
    expect(cells).toHaveLength(1);
    expect(cells.at(0).text()).toBe(noTokensMessage);
  });

  it('should render an h5 element', () => {
    createComponent();

    expect(wrapper.find('h5').text()).toBe(
      sprintf(__('Active %{accessTokenTypePlural} (%{totalAccessTokens})'), {
        accessTokenTypePlural,
        totalAccessTokens: initialActiveAccessTokens.length,
      }),
    );
  });

  it('should render the `GlTable` component with default 6 column headers', () => {
    createComponent();

    const headers = findHeaders();
    expect(headers).toHaveLength(6);
    [
      __('Token name'),
      __('Scopes'),
      s__('AccessTokens|Created'),
      __('Last Used'),
      __('Expires'),
      __('Action'),
    ].forEach((text, index) => {
      expect(headers.at(index).text()).toBe(text);
    });
  });

  it('should render the `GlTable` component with 7 headers', () => {
    createComponent({ showRole: true });

    const headers = findHeaders();
    expect(headers).toHaveLength(7);
    [
      __('Token name'),
      __('Scopes'),
      s__('AccessTokens|Created'),
      __('Last Used'),
      __('Expires'),
      __('Role'),
      __('Action'),
    ].forEach((text, index) => {
      expect(headers.at(index).text()).toBe(text);
    });
  });

  it('`Last Used` header should contain a link and an assistive message', () => {
    createComponent();

    const headers = wrapper.findAll('th');
    const lastUsed = headers.at(3);
    const anchor = lastUsed.find('a');
    const assistiveElement = lastUsed.find('.gl-sr-only');
    expect(anchor.exists()).toBe(true);
    expect(anchor.attributes('href')).toBe(
      '/help/user/profile/personal_access_tokens.md#view-the-last-time-a-token-was-used',
    );
    expect(assistiveElement.text()).toBe(s__('AccessTokens|The last time a token was used'));
  });

  it('updates the table after a success AJAX event', async () => {
    createComponent({ showRole: true });
    await triggerSuccess();

    const cells = findCells();
    expect(cells).toHaveLength(14);

    // First row
    expect(cells.at(0).text()).toBe('a');
    expect(cells.at(1).text()).toBe('api');
    expect(cells.at(2).text()).not.toBe(__('Never'));
    expect(cells.at(3).text()).toBe(__('Never'));
    expect(cells.at(4).text()).toBe(__('Never'));
    expect(cells.at(5).text()).toBe('Maintainer');
    let anchor = cells.at(6).find('a');
    expect(anchor.attributes()).toMatchObject({
      'aria-label': __('Revoke'),
      'data-qa-selector': __('revoke_button'),
      href: '/-/profile/personal_access_tokens/1/revoke',
      'data-confirm': sprintf(
        __(
          'Are you sure you want to revoke this %{accessTokenType}? This action cannot be undone.',
        ),
        { accessTokenType },
      ),
    });

    expect(anchor.classes()).toContain('btn-danger-secondary');

    // Second row
    expect(cells.at(7).text()).toBe('b');
    expect(cells.at(8).text()).toBe('api, sudo');
    expect(cells.at(9).text()).not.toBe(__('Never'));
    expect(cells.at(10).text()).not.toBe(__('Never'));
    expect(cells.at(11).text()).toBe(__('Expired'));
    expect(cells.at(12).text()).toBe('Maintainer');
    anchor = cells.at(13).find('a');
    expect(anchor.attributes('href')).toBe('/-/profile/personal_access_tokens/2/revoke');
    expect(anchor.classes()).toEqual(['btn', 'btn-danger', 'btn-md', 'gl-button', 'btn-icon']);
  });

  it('sorts rows alphabetically', async () => {
    createComponent({ showRole: true });
    await triggerSuccess();

    const cells = findCells();

    // First and second rows
    expect(cells.at(0).text()).toBe('a');
    expect(cells.at(7).text()).toBe('b');

    const headers = findHeaders();
    await headers.at(0).trigger('click');
    await headers.at(0).trigger('click');

    // First and second rows have swapped
    expect(cells.at(0).text()).toBe('b');
    expect(cells.at(7).text()).toBe('a');
  });

  it('sorts rows by date', async () => {
    createComponent({ showRole: true });
    await triggerSuccess();

    const cells = findCells();

    // First and second rows
    expect(cells.at(3).text()).toBe('Never');
    expect(cells.at(10).text()).not.toBe('Never');

    const headers = findHeaders();
    await headers.at(3).trigger('click');

    // First and second rows have swapped
    expect(cells.at(3).text()).not.toBe('Never');
    expect(cells.at(10).text()).toBe('Never');
  });
});
