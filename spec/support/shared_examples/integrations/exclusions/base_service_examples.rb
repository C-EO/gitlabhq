# frozen_string_literal: true

RSpec.shared_examples 'exclusions base service' do
  context 'when the integration is not instance specific', :enable_admin_mode do
    let(:integration_name) { 'mock_ci' }

    it 'returns an error response' do
      expect(execute).to be_error
      expect(execute.message).to eq('not instance specific')
    end
  end

  context 'when the user is not authorized', :enable_admin_mode do
    let(:current_user) { user }

    it 'returns an error response' do
      expect(execute).to be_error
      expect(execute.message).to eq('not authorized')
    end
  end
end
