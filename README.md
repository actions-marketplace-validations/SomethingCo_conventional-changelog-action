# Conventional Changlog GitHub Action

This action generates a changelog based on conventional commit history and updates the recently created release.

## Usage

```yaml
- uses: '@somethingco/conventional-changelog-action'
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
