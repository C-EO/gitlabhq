module Gitlab
  module Ci
    class Config
      module Node
        ##
        # Base abstract class for each configuration entry node.
        #
        class Entry
          class InvalidError < StandardError; end

          attr_reader :config
          attr_accessor :key, :parent, :description

          def initialize(config)
            @config = config
            @nodes = {}
            @validator = self.class.validator.new(self)
            @validator.validate
          end

          def process!
            return if leaf?
            return unless valid?

            compose!
            process_nodes!
          end

          def leaf?
            nodes.none?
          end

          def nodes
            self.class.nodes
          end

          def descendants
            @nodes.values
          end

          def ancestors
            @parent ? @parent.ancestors + [@parent] : []
          end

          def valid?
            errors.none?
          end

          def errors
            @validator.messages + @nodes.values.flat_map(&:errors)
          end

          def value
            if leaf?
              @config
            else
              defined = @nodes.select { |_key, value| value.defined? }
              Hash[defined.map { |key, node| [key, node.value] }]
            end
          end

          def defined?
            true
          end

          def self.default
          end

          def self.nodes
            {}
          end

          def self.validator
            Validator
          end

          private

          def compose!
            nodes.each do |key, essence|
              @nodes[key] = create_node(key, essence)
            end
          end

          def process_nodes!
            @nodes.each_value(&:process!)
          end

          def create_node(key, essence)
            raise NotImplementedError
          end
        end
      end
    end
  end
end
