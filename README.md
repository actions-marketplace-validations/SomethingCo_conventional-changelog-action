# Conventional Changlog GitHub Action

This action generates a changelog based on conventional commit history and updates the recently created release.

## Usage

```yaml
- uses: SomethingCo/conventional-changelog-action@latest
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

(`secrets.GITHUB_TOKEN` is added by GitHub, you don't need to do anything.)
