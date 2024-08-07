// Package badgateway provides a custom HTTP RoundTripper implementation for handling Bad Gateway errors.
package badgateway

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/base64"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"strings"
	"time"

	"gitlab.com/gitlab-org/gitlab/workhorse/internal/log"
)

//go:embed embed/gdk-lg.svg
var gitlabLogo []byte

// Error is a custom error for pretty Sentry 'issues'
type sentryError struct{ error }

type roundTripper struct {
	next            http.RoundTripper
	developmentMode bool
}

// NewRoundTripper creates a RoundTripper with a provided underlying next transport
func NewRoundTripper(developmentMode bool, next http.RoundTripper) http.RoundTripper {
	return &roundTripper{next: next, developmentMode: developmentMode}
}

func (t *roundTripper) RoundTrip(r *http.Request) (*http.Response, error) {
	start := time.Now()

	res, err := t.next.RoundTrip(r)
	if err == nil {
		return res, err
	}

	// httputil.ReverseProxy translates all errors from this
	// RoundTrip function into 500 errors. But the most likely error
	// is that the Rails app is not responding, in which case users
	// and administrators expect to see a 502 error. To show 502s
	// instead of 500s we catch the RoundTrip error here and inject a
	// 502 response.
	fields := log.Fields{"duration_ms": int64(time.Since(start).Seconds() * 1000)}
	log.WithRequest(r).WithFields(fields).WithError(&sentryError{fmt.Errorf("badgateway: failed to receive response: %v", err)}).Error()

	code := http.StatusBadGateway
	if r.Context().Err() == context.Canceled {
		code = 499 // Code used by NGINX when client disconnects
	}

	injectedResponse := &http.Response{
		StatusCode: code,
		Status:     http.StatusText(code),

		Request:    r,
		ProtoMajor: r.ProtoMajor,
		ProtoMinor: r.ProtoMinor,
		Proto:      r.Proto,
		Header:     make(http.Header),
		Trailer:    make(http.Header),
	}

	message := "GitLab is not responding"
	contentType := "text/plain"
	if t.developmentMode {
		message, contentType = developmentModeResponse(err)
	}

	injectedResponse.Body = io.NopCloser(strings.NewReader(message))
	injectedResponse.Header.Set("Content-Type", contentType)

	return injectedResponse, nil
}

func developmentModeResponse(err error) (body string, contentType string) {
	data := TemplateData{
		Time:                    time.Now().Format("15:04:05"),
		Error:                   err.Error(),
		ReloadSeconds:           5,
		Base64EncodedGitLabLogo: base64.StdEncoding.EncodeToString(gitlabLogo),
	}

	buf := &bytes.Buffer{}
	if err := developmentErrorTemplate.Execute(buf, data); err != nil {
		return data.Error, "text/plain"
	}

	return buf.String(), "text/html"
}

// TemplateData holds data for rendering templates.
type TemplateData struct {
	Time                    string
	Error                   string
	ReloadSeconds           int
	Base64EncodedGitLabLogo string
}

var developmentErrorTemplate = template.Must(template.New("error502").Parse(`
<!DOCTYPE html>
<html lang="en">

<head>
	<title>Waiting for GitLab to boot</title>

	<style>
		body {
			color: #333238;
			text-align: center;
			font-family: "Nunito Sans", -apple-system, ".SFNSText-Regular", "San Francisco", BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
		}

		h1 {
			font-size: 1.75rem;
			line-height: 2.25rem;
			margin: 1rem 0;
		}

		p {
			margin-bottom: .5rem;
		}

		img {
			display: block;
			margin: 0 auto;
		}

		.error-container {
			max-width: 65ch;
			margin: auto;
			padding: 1rem 0;
		}

		.footer {
			margin: 1rem 0 0 0;
			padding: 1rem 0 0 0;
			border-top: 1px solid #dcdcde;
			color: #737278;
			font-size: 0.75rem;
		}

		.footer p {
			margin: 0;
		}

		@media (prefers-color-scheme: dark) {
			body {
				background-color: #18171d;
				color: #ececef;
			}

			.footer {
				border-top-color: #3a383f;
			}
		}
	</style>
</head>

<body>
	<div class="error-container">
 		<img src="data:image/svg+xml;base64,{{.Base64EncodedGitLabLogo}}" alt="GitLab" />

		<h1>Waiting for GitLab to boot</h1>

		<pre>{{.Error}}</pre>

		<br/>

		<p>It can take 60-180 seconds for GitLab to boot completely.</p>
		<p>This page will automatically reload every {{.ReloadSeconds}} seconds.</p>

		<br/>

		<footer class="footer">
			<p>Generated by gitlab-workhorse running in development mode at {{.Time}}.</p>
		</footer>
	</div>

	<script>
		window.setTimeout(function() { location.reload(); }, {{.ReloadSeconds}} * 1000)
	</script>
</body>

</html>
`))
