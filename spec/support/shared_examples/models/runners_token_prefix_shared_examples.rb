# frozen_string_literal: true

RSpec.shared_examples 'it has a prefixable runners_token' do
  describe '#runners_token' do
    it 'has a runners_token_prefix' do
      expect(subject.runners_token_prefix).not_to be_empty
    end

    it 'starts with the runners_token_prefix' do
      expect(subject.runners_token).to start_with(subject.runners_token_prefix)
    end
  end
end
