# frozen_string_literal:true

module Authn
  module Tokens
    class FeedToken
      def self.prefix?(plaintext)
        plaintext.start_with?(::User.prefix_for_feed_token,
          Authn::TokenField::PrefixHelper.default_instance_prefix(::User.prefix_for_feed_token))
      end

      attr_reader :revocable, :source

      def initialize(plaintext, source)
        @revocable = User.find_by_feed_token(plaintext)
        @source = source
      end

      def present_with
        ::API::Entities::User
      end

      def revoke!(current_user)
        raise ::Authn::AgnosticTokenIdentifier::NotFoundError, 'Not Found' if revocable.blank?

        Users::ResetFeedTokenService.new(
          current_user,
          user: revocable,
          source: source
        ).execute
      end
    end
  end
end
