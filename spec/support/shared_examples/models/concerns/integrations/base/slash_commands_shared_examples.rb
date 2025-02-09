# frozen_string_literal: true

RSpec.shared_examples Integrations::Base::SlashCommands do
  describe "Associations" do
    it { is_expected.to respond_to :token }
  end

  describe 'default values' do
    it { expect(subject.category).to eq(:chat) }
  end

  describe '#valid_token?' do
    subject { described_class.new }

    context 'when the token is empty' do
      it 'is false' do
        expect(subject.valid_token?('wer')).to be_falsey
      end
    end

    context 'when there is a token' do
      before do
        subject.token = '123'
      end

      it 'accepts equal tokens' do
        expect(subject.valid_token?('123')).to be_truthy
      end
    end
  end

  describe '#trigger' do
    subject { described_class.new }

    context 'when token is not passed' do
      let(:params) { {} }

      it 'returns nil' do
        expect(subject.trigger(params)).to be_nil
      end
    end

    context 'with a token passed' do
      let(:project) { create(:project) }
      let(:params) { { token: 'token' } }

      before do
        allow(subject).to receive(:token).and_return('token')
      end

      context 'when user does not exist' do
        context 'when no url can be generated' do
          it 'responds with the authorize url' do
            response = subject.trigger(params)

            expect(response[:response_type]).to eq :ephemeral
            expect(response[:text]).to start_with ":sweat_smile: Couldn't identify you"
          end
        end

        context 'when an auth url can be generated' do
          let(:params) do
            {
              team_domain: 'http://domain.tld',
              team_id: 'T3423423',
              user_id: 'U234234',
              user_name: 'mepmep',
              token: 'token'
            }
          end

          let(:integration) do
            project.create_mattermost_slash_commands_integration(
              properties: { token: 'token' }
            )
          end

          it 'generates the url' do
            response = integration.trigger(params)

            expect(response[:text]).to start_with(':wave: Hi there!')
          end
        end
      end

      context 'when the user is authenticated' do
        let!(:chat_name) { create(:chat_name) }
        let(:params) { { token: 'token', team_id: chat_name.team_id, user_id: chat_name.chat_id } }

        subject do
          described_class.create!(project: project, properties: { token: 'token' })
        end

        context 'with verified request' do
          before do
            allow_next_instance_of(::Gitlab::SlashCommands::VerifyRequest) do |instance|
              allow(instance).to receive(:valid?).and_return(true)
            end
          end

          it 'triggers the command' do
            expect_any_instance_of(Gitlab::SlashCommands::Command).to receive(:execute) # rubocop:disable RSpec/AnyInstanceOf -- Legacy use

            subject.trigger(params)
          end

          shared_examples_for 'blocks command execution' do
            it 'blocks command execution' do
              expect_any_instance_of(Gitlab::SlashCommands::Command).not_to receive(:execute) # rubocop:disable RSpec/AnyInstanceOf -- Legacy use

              result = subject.trigger(params)
              expect(result[:text]).to match(error_message)
            end
          end

          context 'when user is blocked' do
            before do
              chat_name.user.block
            end

            it_behaves_like 'blocks command execution' do
              let(:error_message) { 'you do not have access to the GitLab project' }
            end
          end

          context 'when user is deactivated' do
            before do
              chat_name.user.deactivate
            end

            it_behaves_like 'blocks command execution' do
              let(:error_message) { "your #{Gitlab.config.gitlab.url} account needs to be reactivated" }
            end
          end
        end

        context 'with unverified request' do
          before do
            allow_next_instance_of(::Gitlab::SlashCommands::VerifyRequest) do |instance|
              allow(instance).to receive(:valid?).and_return(false)
            end
          end

          let(:params) do
            {
              team_domain: 'http://domain.tld',
              channel_name: 'channel-test',
              team_id: chat_name.team_id,
              user_id: chat_name.chat_id,
              response_url: 'http://domain.tld/commands',
              token: 'token'
            }
          end

          it 'caches the slash command params and returns confirmation message' do
            expect(Rails.cache).to receive(:write).with(an_instance_of(String), params, { expires_in: 3.minutes })
            expect_any_instance_of(Gitlab::SlashCommands::Presenters::Access).to receive(:confirm) # rubocop:disable RSpec/AnyInstanceOf -- Legacy use

            subject.trigger(params)
          end
        end
      end
    end
  end
end
