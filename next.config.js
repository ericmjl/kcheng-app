/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  webpack: (config) => {
    // Force resolution from this app when parent has a lockfile (monorepo)
    config.context = __dirname;
    config.resolve.modules = [path.join(__dirname, "node_modules"), "node_modules"];
    return config;
  },
};

module.exports = nextConfig;
