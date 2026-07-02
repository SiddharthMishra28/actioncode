# Troubleshooting

## Common Issues

### 1. "Configuration file not found"

**Cause**: The application cannot find configuration files.

**Solution**:
- Ensure you're running from the project root directory
- Check that `config/` directory exists
- Verify YAML files are present

```bash
ls config/
# Should show: telegram.yml, repositories.yml, models.yml, limits.yml, build.yml, notifications.yml
```

### 2. "Telegram bot token is invalid"

**Cause**: The bot token is incorrect or expired.

**Solution**:
1. Go to @BotFather on Telegram
2. Use `/mybots` to see your bots
3. Select your bot and click "API Token"
4. Copy the token and update `.env`

### 3. "GitHub token is invalid"

**Cause**: The GitHub token is incorrect or lacks permissions.

**Solution**:
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create a new token with `repo` scope
3. Copy the token and update `.env`

### 4. "Repository not found"

**Cause**: The repository name is incorrect or the token lacks access.

**Solution**:
- Verify the repository name in `config/repositories.yml`
- Ensure your GitHub token has access to the repository
- Check the repository exists and is spelled correctly

### 5. "User not authorized"

**Cause**: The Telegram user ID is not in the allowlist.

**Solution**:
1. Send `/start` to @userinfobot to get your user ID
2. Add your user ID to `config/telegram.yml` under `allowedUsers`
3. Add your user ID to the repository's `allowedUsers` in `config/repositories.yml`

### 6. "Workflow dispatch failed"

**Cause**: The GitHub Actions workflow cannot be triggered.

**Solution**:
- Ensure the workflow file exists at `.github/workflows/opencode-agent.yml`
- Check that your GitHub token has `actions:write` permission
- Verify the workflow is not disabled

### 7. "Build failed after retries"

**Cause**: The AI-generated code has build errors.

**Solution**:
- Check the build logs in the Telegram reply
- Review the PR for obvious issues
- Run the build locally to reproduce
- Provide more specific instructions in your next request

### 8. "Tests failed"

**Cause**: The AI-generated code breaks existing tests.

**Solution**:
- Review the test failure details
- Check if the changes are correct
- Provide test-specific instructions
- Consider using `/test` command first

### 9. "Rate limit exceeded"

**Cause**: Too many requests in a short time.

**Solution**:
- Wait for the rate limit window to reset
- Reduce request frequency
- Contact administrator to increase limits

### 10. "Webhook not receiving updates"

**Cause**: Telegram webhook is not configured correctly.

**Solution**:
1. For development, use polling mode (default)
2. For production, set up webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/webhook/telegram"
   ```
3. Verify webhook URL is accessible

## Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run dev
```

### Check Logs

```bash
# View logs in real-time
tail -f logs/app.log

# Search for errors
grep "error" logs/app.log
```

### Test Webhook Locally

```bash
# Use ngrok to expose local server
ngrok http 3000

# Update Telegram webhook
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<NGROK_URL>/webhook/telegram"
```

### Test GitHub Webhook

```bash
# Send test event
curl -X POST http://localhost:3000/webhook/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: workflow_run" \
  -d '{"action": "completed", "workflow_run": {"id": 123, "conclusion": "success"}}'
```

## Performance Issues

### Slow Response Times

**Causes**:
- Network latency
- Large repositories
- Complex instructions

**Solutions**:
- Use specific, focused instructions
- Break large tasks into smaller ones
- Consider caching for repeated operations

### Memory Usage

**Causes**:
- Large number of concurrent requests
- Memory leaks

**Solutions**:
- Restart the service periodically
- Monitor memory usage
- Reduce concurrent request limits

## Getting Help

### Check Documentation

- [Installation Guide](./installation.md)
- [Configuration Guide](./configuration.md)
- [Architecture](./architecture.md)

### Report Issues

1. Check existing issues on GitHub
2. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Expected vs actual behavior
   - Log output

### Community

- GitHub Discussions
- Discord server (if available)
- Stack Overflow with `actioncode` tag
