{
  description = "DMR documentation site – Starlight/Astro";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
            pkgs.pnpm
          ];

          shellHook = ''
            echo "DMR docs environment ready (Node $(node --version), pnpm $(pnpm --version))."
            echo ""
            echo "First time setup:"
            echo "  pnpm install"
            echo ""
            echo "Dev server:"
            echo "  pnpm dev"
            echo ""
            echo "Build:"
            echo "  pnpm build"
          '';
        };
      }
    );
}
