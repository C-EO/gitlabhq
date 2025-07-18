---
stage: Verify
group: Pipeline Authoring
info: To determine the technical writer assigned to the Stage/Group associated with this page, see https://handbook.gitlab.com/handbook/product/ux/technical-writing/#assignments
title: Caching in GitLab CI/CD
---

{{< details >}}

- Tier: Free, Premium, Ultimate
- Offering: GitLab.com, GitLab Self-Managed, GitLab Dedicated

{{< /details >}}

A cache is one or more files a job downloads and saves. Subsequent jobs that use
the same cache don't have to download the files again, so they execute more quickly.

To learn how to define the cache in your `.gitlab-ci.yml` file,
see the [`cache` reference](../yaml/_index.md#cache).

## How cache is different from artifacts

Use cache for dependencies, like packages you download from the internet.
Cache is stored where GitLab Runner is installed and uploaded to S3 if
[distributed cache is enabled](https://docs.gitlab.com/runner/configuration/autoscale.html#distributed-runners-caching).

Use artifacts to pass intermediate build results between stages.
Artifacts are generated by a job, stored in GitLab, and can be downloaded.

Both artifacts and caches define their paths relative to the project directory, and
can't link to files outside it.

### Cache

- Define cache per job by using the `cache` keyword. Otherwise it is disabled.
- Subsequent pipelines can use the cache.
- Subsequent jobs in the same pipeline can use the cache, if the dependencies are identical.
- Different projects cannot share the cache.
- By default, protected and non-protected branches [do not share the cache](#cache-key-names). However, you can [change this behavior](#use-the-same-cache-for-all-branches).

### Artifacts

- Define artifacts per job.
- Subsequent jobs in later stages of the same pipeline can use artifacts.
- Artifacts expire after 30 days by default. You can define a custom [expiration time](../yaml/_index.md#artifactsexpire_in).
- The latest artifacts do not expire if [keep latest artifacts](../jobs/job_artifacts.md#keep-artifacts-from-most-recent-successful-jobs) is enabled.
- Use [dependencies](../yaml/_index.md#dependencies) to control which jobs fetch the artifacts.

## Good caching practices

To ensure maximum availability of the cache, do one or more of the following:

- [Tag your runners](../runners/configure_runners.md#control-jobs-that-a-runner-can-run) and use the tag on jobs
  that share the cache.
- [Use runners that are only available to a particular project](../runners/runners_scope.md#prevent-a-project-runner-from-being-enabled-for-other-projects).
- [Use a `key`](../yaml/_index.md#cachekey) that fits your workflow. For example,
  you can configure a different cache for each branch.

For runners to work with caches efficiently, you must do one of the following:

- Use a single runner for all your jobs.
- Use multiple runners that have
  [distributed caching](https://docs.gitlab.com/runner/configuration/autoscale.html#distributed-runners-caching),
  where the cache is stored in S3 buckets. Instance runners on GitLab.com behave this way. These runners can be in autoscale mode,
  but they don't have to be. To manage cache objects,
  apply lifecycle rules to delete the cache objects after a period of time.
  Lifecycle rules are available on the object storage server.
- Use multiple runners with the same architecture and have these runners
  share a common network-mounted directory to store the cache. This directory should use NFS or something similar.
  These runners must be in autoscale mode.

## Use multiple caches

You can have a maximum of four caches:

```yaml
test-job:
  stage: build
  cache:
    - key:
        files:
          - Gemfile.lock
      paths:
        - vendor/ruby
    - key:
        files:
          - yarn.lock
      paths:
        - .yarn-cache/
  script:
    - bundle config set --local path 'vendor/ruby'
    - bundle install
    - yarn install --cache-folder .yarn-cache
    - echo Run tests...
```

If multiple caches are combined with a fallback cache key,
the global fallback cache is fetched every time a cache is not found.

## Use a fallback cache key

### Per-cache fallback keys

{{< history >}}

- [Introduced](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/110467) in GitLab 16.0

{{< /history >}}

Each cache entry supports up to five fallback keys with the [`fallback_keys` keyword](../yaml/_index.md#cachefallback_keys).
When a job does not find a cache key, the job attempts to retrieve a fallback cache instead.
Fallback keys are searched in order until a cache is found. If no cache is found,
the job runs without using a cache. For example:

```yaml
test-job:
  stage: build
  cache:
    - key: cache-$CI_COMMIT_REF_SLUG
      fallback_keys:
        - cache-$CI_DEFAULT_BRANCH
        - cache-default
      paths:
        - vendor/ruby
  script:
    - bundle config set --local path 'vendor/ruby'
    - bundle install
    - echo Run tests...
```

In this example:

1. The job looks for the `cache-$CI_COMMIT_REF_SLUG` cache.
1. If `cache-$CI_COMMIT_REF_SLUG` is not found, the job looks for `cache-$CI_DEFAULT_BRANCH`
   as a fallback option.
1. If `cache-$CI_DEFAULT_BRANCH` is also not found, the job looks for `cache-default`
   as a second fallback option.
1. If none are found, the job downloads all the Ruby dependencies without using a cache,
   but creates a new cache for `cache-$CI_COMMIT_REF_SLUG` when the job completes.

Fallback keys follow the same processing logic as `cache:key`:

- If you [clear caches manually](#clear-the-cache-manually), per-cache fallback keys are appended
  with an index like other cache keys.
- If the [**Use separate caches for protected branches** setting](#cache-key-names) is enabled,
  per-cache fallback keys are appended with `-protected` or `-non_protected`.

### Global fallback key

You can use the `$CI_COMMIT_REF_SLUG` [predefined variable](../variables/predefined_variables.md)
to specify your [`cache:key`](../yaml/_index.md#cachekey). For example, if your
`$CI_COMMIT_REF_SLUG` is `test`, you can set a job to download cache that's tagged with `test`.

If a cache with this tag is not found, you can use `CACHE_FALLBACK_KEY` to
specify a cache to use when none exists.

In the following example, if the `$CI_COMMIT_REF_SLUG` is not found, the job uses the key defined
by the `CACHE_FALLBACK_KEY` variable:

```yaml
variables:
  CACHE_FALLBACK_KEY: fallback-key

job1:
  script:
    - echo
  cache:
    key: "$CI_COMMIT_REF_SLUG"
    paths:
      - binaries/
```

The order of caches extraction is:

1. Retrieval attempt for `cache:key`
1. Retrieval attempts for each entry in order in `fallback_keys`
1. Retrieval attempt for the global fallback key in `CACHE_FALLBACK_KEY`

The cache extraction process stops after the first successful cache is retrieved.

## Disable cache for specific jobs

If you define the cache globally, each job uses the
same definition. You can override this behavior for each job.

To disable it completely for a job, use an empty list:

```yaml
job:
  cache: []
```

## Inherit global configuration, but override specific settings per job

You can override cache settings without overwriting the global cache by using
[anchors](../yaml/yaml_optimization.md#anchors). For example, if you want to override the
`policy` for one job:

```yaml
default:
  cache: &global_cache
    key: $CI_COMMIT_REF_SLUG
    paths:
      - node_modules/
      - public/
      - vendor/
    policy: pull-push

job:
  cache:
    # inherit all global cache settings
    <<: *global_cache
    # override the policy
    policy: pull
```

For more information, see [`cache: policy`](../yaml/_index.md#cachepolicy).

## Common use cases for caches

Usually you use caches to avoid downloading content, like dependencies
or libraries, each time you run a job. Node.js packages,
PHP packages, Ruby gems, Python libraries, and others can be cached.

For examples, see the [GitLab CI/CD templates](https://gitlab.com/gitlab-org/gitlab/-/tree/master/lib/gitlab/ci/templates).

### Share caches between jobs in the same branch

To have jobs in each branch use the same cache, define a cache with the `key: $CI_COMMIT_REF_SLUG`:

```yaml
cache:
  key: $CI_COMMIT_REF_SLUG
```

This configuration prevents you from accidentally overwriting the cache. However, the
first pipeline for a merge request is slow. The next time a commit is pushed to the branch, the
cache is re-used and jobs run faster.

To enable per-job and per-branch caching:

```yaml
cache:
  key: "$CI_JOB_NAME-$CI_COMMIT_REF_SLUG"
```

To enable per-stage and per-branch caching:

```yaml
cache:
  key: "$CI_JOB_STAGE-$CI_COMMIT_REF_SLUG"
```

### Share caches across jobs in different branches

To share a cache across all branches and all jobs, use the same key for everything:

```yaml
cache:
  key: one-key-to-rule-them-all
```

To share a cache between branches, but have a unique cache for each job:

```yaml
cache:
  key: $CI_JOB_NAME
```

### Use a variable to control a job's cache policy

{{< history >}}

- [Introduced](https://gitlab.com/gitlab-org/gitlab/-/issues/371480) in GitLab 16.1.

{{< /history >}}

To reduce duplication of jobs where the only difference is the pull policy, you can use a [CI/CD variable](../variables/_index.md).

For example:

```yaml
conditional-policy:
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      variables:
        POLICY: pull-push
    - if: $CI_COMMIT_BRANCH != $CI_DEFAULT_BRANCH
      variables:
        POLICY: pull
  stage: build
  cache:
    key: gems
    policy: $POLICY
    paths:
      - vendor/bundle
  script:
    - echo "This job pulls and pushes the cache depending on the branch"
    - echo "Downloading dependencies..."
```

In this example, the job's cache policy is:

- `pull-push` for changes to the default branch.
- `pull` for changes to other branches.

### Cache Node.js dependencies

If your project uses [npm](https://www.npmjs.com/) to install Node.js
dependencies, the following example defines a default `cache` so that all jobs inherit it.
By default, npm stores cache data in the home folder (`~/.npm`). However, you
[can't cache things outside of the project directory](../yaml/_index.md#cachepaths).
Instead, tell npm to use `./.npm`, and cache it per-branch:

```yaml
default:
  image: node:latest
  cache:  # Cache modules in between jobs
    key: $CI_COMMIT_REF_SLUG
    paths:
      - .npm/
  before_script:
    - npm ci --cache .npm --prefer-offline

test_async:
  script:
    - node ./specs/start.js ./specs/async.spec.js
```

#### Compute the cache key from the lock file

You can use [`cache:key:files`](../yaml/_index.md#cachekeyfiles) to compute the cache
key from a lock file like `package-lock.json` or `yarn.lock`, and reuse it in many jobs.

```yaml
default:
  cache:  # Cache modules using lock file
    key:
      files:
        - package-lock.json
    paths:
      - .npm/
```

If you're using [Yarn](https://yarnpkg.com/), you can use [`yarn-offline-mirror`](https://classic.yarnpkg.com/blog/2016/11/24/offline-mirror/)
to cache the zipped `node_modules` tarballs. The cache generates more quickly, because
fewer files have to be compressed:

```yaml
job:
  script:
    - echo 'yarn-offline-mirror ".yarn-cache/"' >> .yarnrc
    - echo 'yarn-offline-mirror-pruning true' >> .yarnrc
    - yarn install --frozen-lockfile --no-progress
  cache:
    key:
      files:
        - yarn.lock
    paths:
      - .yarn-cache/
```

### Cache C/C++ compilation using Ccache

If you are compiling C/C++ projects, you can use [Ccache](https://ccache.dev/) to
speed up your build times. Ccache speeds up recompilation by caching previous compilations
and detecting when the same compilation is being done again. When building big projects like the Linux kernel,
you can expect significantly faster compilations.

Use `cache` to reuse the created cache between jobs, for example:

```yaml
job:
  cache:
    paths:
      - ccache
  before_script:
    - export PATH="/usr/lib/ccache:$PATH"  # Override compiler path with ccache (this example is for Debian)
    - export CCACHE_DIR="${CI_PROJECT_DIR}/ccache"
    - export CCACHE_BASEDIR="${CI_PROJECT_DIR}"
    - export CCACHE_COMPILERCHECK=content  # Compiler mtime might change in the container, use checksums instead
  script:
    - ccache --zero-stats || true
    - time make                            # Actually build your code while measuring time and cache efficiency.
    - ccache --show-stats || true
```

If you have multiple projects in a single repository you do not need a separate `CCACHE_BASEDIR` for each of them.

### Cache PHP dependencies

If your project uses [Composer](https://getcomposer.org/) to install
PHP dependencies, the following example defines a default `cache` so that
all jobs inherit it. PHP libraries modules are installed in `vendor/` and
are cached per-branch:

```yaml
default:
  image: php:latest
  cache:  # Cache libraries in between jobs
    key: $CI_COMMIT_REF_SLUG
    paths:
      - vendor/
  before_script:
    # Install and run Composer
    - curl --show-error --silent "https://getcomposer.org/installer" | php
    - php composer.phar install

test:
  script:
    - vendor/bin/phpunit --configuration phpunit.xml --coverage-text --colors=never
```

### Cache Python dependencies

If your project uses [pip](https://pip.pypa.io/en/stable/) to install
Python dependencies, the following example defines a default `cache` so that
all jobs inherit it. pip's cache is defined under `.cache/pip/` and is cached per-branch:

```yaml
default:
  image: python:latest
  cache:                      # Pip's cache doesn't store the python packages
    paths:                    # https://pip.pypa.io/en/stable/topics/caching/
      - .cache/pip
  before_script:
    - python -V               # Print out python version for debugging
    - pip install virtualenv
    - virtualenv venv
    - source venv/bin/activate

variables:  # Change pip's cache directory to be inside the project directory because we can only cache local items.
  PIP_CACHE_DIR: "$CI_PROJECT_DIR/.cache/pip"

test:
  script:
    - python setup.py test
    - pip install ruff
    - ruff --format=gitlab .
```

### Cache Ruby dependencies

If your project uses [Bundler](https://bundler.io) to install
gem dependencies, the following example defines a default `cache` so that all
jobs inherit it. Gems are installed in `vendor/ruby/` and are cached per-branch:

```yaml
default:
  image: ruby:latest
  cache:                                            # Cache gems in between builds
    key: $CI_COMMIT_REF_SLUG
    paths:
      - vendor/ruby
  before_script:
    - ruby -v                                       # Print out ruby version for debugging
    - bundle config set --local path 'vendor/ruby'  # The location to install the specified gems to
    - bundle install -j $(nproc)                    # Install dependencies into ./vendor/ruby

rspec:
  script:
    - rspec spec
```

If you have jobs that need different gems, use the `prefix`
keyword in the global `cache` definition. This configuration generates a different
cache for each job.

For example, a testing job might not need the same gems as a job that deploys to
production:

```yaml
default:
  cache:
    key:
      files:
        - Gemfile.lock
      prefix: $CI_JOB_NAME
    paths:
      - vendor/ruby

test_job:
  stage: test
  before_script:
    - bundle config set --local path 'vendor/ruby'
    - bundle install --without production
  script:
    - bundle exec rspec

deploy_job:
  stage: production
  before_script:
    - bundle config set --local path 'vendor/ruby'   # The location to install the specified gems to
    - bundle install --without test
  script:
    - bundle exec deploy
```

### Cache Go dependencies

If your project uses [Go Modules](https://go.dev/wiki/Modules) to install
Go dependencies, the following example defines `cache` in a `go-cache` template, that
any job can extend. Go modules are installed in `${GOPATH}/pkg/mod/` and
are cached for all of the `go` projects:

```yaml
.go-cache:
  variables:
    GOPATH: $CI_PROJECT_DIR/.go
  before_script:
    - mkdir -p .go
  cache:
    paths:
      - .go/pkg/mod/

test:
  image: golang:latest
  extends: .go-cache
  script:
    - go test ./... -v -short
```

### Cache curl downloads

If your project uses [cURL](https://curl.se/) to download dependencies or files,
you can cache the downloaded content. The files are automatically updated when
newer downloads are available.

```yaml
job:
  script:
    - curl --remote-time --time-cond .curl-cache/caching.md --output .curl-cache/caching.md "https://docs.gitlab.com/ci/caching/"
  cache:
    paths:
      - .curl-cache/
```

In this example cURL downloads a file from a webserver and saves it to a local file in `.curl-cache/`.
The `--remote-time` flag saves the last modification time reported by the server,
and cURL compares it to the timestamp of the cached file with `--time-cond`. If the remote file has
a more recent timestamp the local cache is automatically updated.

## Availability of the cache

Caching is an optimization, but it isn't guaranteed to always work. You might need
to regenerate cached files in each job that needs them.

After you define a [cache in `.gitlab-ci.yml`](../yaml/_index.md#cache),
the availability of the cache depends on:

- The runner's executor type.
- Whether different runners are used to pass the cache between jobs.

### Where the caches are stored

All caches defined for a job are archived in a single `cache.zip` file.
The runner configuration defines where the file is stored. By default, the cache
is stored on the machine where GitLab Runner is installed. The location also depends on the type of executor.

| Runner executor        | Default path of the cache |
| ---------------------- | ------------------------- |
| [Shell](https://docs.gitlab.com/runner/executors/shell.html) | Locally, under the `gitlab-runner` user's home directory: `/home/gitlab-runner/cache/<user>/<project>/<cache-key>/cache.zip`. |
| [Docker](https://docs.gitlab.com/runner/executors/docker.html) | Locally, under [Docker volumes](https://docs.gitlab.com/runner/executors/docker.html#configure-directories-for-the-container-build-and-cache): `/var/lib/docker/volumes/<volume-id>/_data/<user>/<project>/<cache-key>/cache.zip`. |
| [Docker Machine](https://docs.gitlab.com/runner/executors/docker_machine.html) (autoscale runners) | The same as the Docker executor. |

If you use cache and artifacts to store the same path in your jobs, the cache might
be overwritten because caches are restored before artifacts.

#### Cache key names

{{< history >}}

- [Introduced](https://gitlab.com/gitlab-org/gitlab/-/issues/330047) in GitLab 15.0.

{{< /history >}}

A suffix is added to the cache key, with the exception of the [global fallback cache key](#global-fallback-key).

As an example, assuming that `cache.key` is set to `$CI_COMMIT_REF_SLUG`, and that we have two branches `main`
and `feature`, then the following table represents the resulting cache keys:

| Branch name | Cache key |
|-------------|-----------|
| `main`      | `main-protected` |
| `feature`   | `feature-non_protected` |

##### Use the same cache for all branches

{{< history >}}

- [Introduced](https://gitlab.com/gitlab-org/gitlab/-/issues/361643) in GitLab 15.0.

{{< /history >}}

If you do not want to use [cache key names](#cache-key-names),
you can have all branches (protected and unprotected) use the same cache.

The cache separation with [cache key names](#cache-key-names) is a security feature
and should only be disabled in an environment where all users with Developer role are highly trusted.

To use the same cache for all branches:

1. On the left sidebar, select **Search or go to** and find your project.
1. Select **Settings > CI/CD**.
1. Expand **General pipelines**.
1. Clear the **Use separate caches for protected branches** checkbox.
1. Select **Save changes**.

### How archiving and extracting works

This example shows two jobs in two consecutive stages:

```yaml
stages:
  - build
  - test

default:
  cache:
    key: build-cache
    paths:
      - vendor/
  before_script:
    - echo "Hello"

job A:
  stage: build
  script:
    - mkdir vendor/
    - echo "build" > vendor/hello.txt
  after_script:
    - echo "World"

job B:
  stage: test
  script:
    - cat vendor/hello.txt
```

If one machine has one runner installed, then all jobs for your project
run on the same host:

1. Pipeline starts.
1. `job A` runs.
1. The cache is extracted (if found).
1. `before_script` is executed.
1. `script` is executed.
1. `after_script` is executed.
1. `cache` runs and the `vendor/` directory is zipped into `cache.zip`.
   This file is then saved in the directory based on the
   [runner's setting](#where-the-caches-are-stored) and the `cache: key`.
1. `job B` runs.
1. The cache is extracted (if found).
1. `before_script` is executed.
1. `script` is executed.
1. Pipeline finishes.

By using a single runner on a single machine, you don't have the issue where
`job B` might execute on a runner different from `job A`. This setup guarantees the
cache can be reused between stages. It only works if the execution goes from the `build` stage
to the `test` stage in the same runner/machine. Otherwise, the cache [might not be available](#cache-mismatch).

During the caching process, there's also a couple of things to consider:

- If some other job, with another cache configuration had saved its
  cache in the same zip file, it is overwritten. If the S3 based shared cache is
  used, the file is additionally uploaded to S3 to an object based on the cache
  key. So, two jobs with different paths, but the same cache key, overwrites
  their cache.
- When extracting the cache from `cache.zip`, everything in the zip file is
  extracted in the job's working directory (usually the repository which is
  pulled down), and the runner doesn't mind if the archive of `job A` overwrites
  things in the archive of `job B`.

It works this way because the cache created for one runner
often isn't valid when used by a different one. A different runner may run on a
different architecture (for example, when the cache includes binary files). Also,
because the different steps might be executed by runners running on different
machines, it is a safe default.

## Clearing the cache

Runners use [cache](../yaml/_index.md#cache) to speed up the execution
of your jobs by reusing existing data. This can sometimes lead to
inconsistent behavior.

There are two ways to start with a fresh copy of the cache.

### Clear the cache by changing `cache:key`

Change the value for `cache: key` in your `.gitlab-ci.yml` file.
The next time the pipeline runs, the cache is stored in a different location.

### Clear the cache manually

You can clear the cache in the GitLab UI:

1. On the left sidebar, select **Search or go to** and find your project.
1. Select **Build > Pipelines**.
1. In the upper-right corner, select **Clear runner caches**.

On the next commit, your CI/CD jobs use a new cache.

{{< alert type="note" >}}

Each time you clear the cache manually, the [internal cache name](#where-the-caches-are-stored) is updated. The name uses the format `cache-<index>`, and the index increments by one. The old cache is not deleted. You can manually delete these files from the runner storage.

{{< /alert >}}

## Troubleshooting

### Cache mismatch

If you have a cache mismatch, follow these steps to troubleshoot.

| Reason for a cache mismatch | How to fix it |
| --------------------------- | ------------- |
| You use multiple standalone runners (not in autoscale mode) attached to one project without a shared cache. | Use only one runner for your project or use multiple runners with distributed cache enabled. |
| You use runners in autoscale mode without a distributed cache enabled. | Configure the autoscale runner to use a distributed cache. |
| The machine the runner is installed on is low on disk space or, if you've set up distributed cache, the S3 bucket where the cache is stored doesn't have enough space. | Make sure you clear some space to allow new caches to be stored. There's no automatic way to do this. |
| You use the same `key` for jobs where they cache different paths. | Use different cache keys so that the cache archive is stored to a different location and doesn't overwrite wrong caches. |
| You have not enabled the [distributed runner caching on your runners](https://docs.gitlab.com/runner/configuration/autoscale.html#distributed-runners-caching). | Set `Shared = false` and re-provision your runners. |

#### Cache mismatch example 1

If you have only one runner assigned to your project, the cache
is stored on the runner's machine by default.

If two jobs have the same cache key but a different path, the caches can be overwritten.
For example:

```yaml
stages:
  - build
  - test

job A:
  stage: build
  script: make build
  cache:
    key: same-key
    paths:
      - public/

job B:
  stage: test
  script: make test
  cache:
    key: same-key
    paths:
      - vendor/
```

1. `job A` runs.
1. `public/` is cached as `cache.zip`.
1. `job B` runs.
1. The previous cache, if any, is unzipped.
1. `vendor/` is cached as `cache.zip` and overwrites the previous one.
1. The next time `job A` runs it uses the cache of `job B` which is different
   and thus isn't effective.

To fix this issue, use different `keys` for each job.

#### Cache mismatch example 2

In this example, you have more than one runner assigned to your
project, and distributed cache is not enabled.

The second time the pipeline runs, you want `job A` and `job B` to re-use their cache (which in this case
is different):

```yaml
stages:
  - build
  - test

job A:
  stage: build
  script: build
  cache:
    key: keyA
    paths:
      - vendor/

job B:
  stage: test
  script: test
  cache:
    key: keyB
    paths:
      - vendor/
```

Even if the `key` is different, the cached files might get "cleaned" before each
stage if the jobs run on different runners in subsequent pipelines.

### Concurrent runners missing local cache

If you have configured multiple concurrent runners with the Docker executor, locally cached files might
not be present for concurrently-running jobs as you expect. The names of cache volumes are constructed
uniquely for each runner instance, so files cached by one runner instance are not found in the cache by another runner
instance.

To share the cache between concurrent runners, you can either:

- Use the `[runners.docker]` section of the runners' `config.toml` to configure a single mount point on the host that
  is mapped to `/cache` in each container, preventing the runner from creating unique volume names.
- Use a distributed cache.
