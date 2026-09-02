import type { NextConfig } from "next";

// GitHub project pages are served from /<repository-name>. Keep local
// development at /, and derive the deployed path automatically in Actions.
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const basePath = process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath,
};

export default nextConfig;
