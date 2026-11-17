
[build]
  publish = "public"
  command = "echo Building"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/api/:splat"
  status = 200
  force = true

