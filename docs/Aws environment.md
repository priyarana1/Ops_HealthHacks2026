# AWS environment facts for ClearPath

Claude Code: read this file before writing any infrastructure. Do not assume anything that is not stated here. If a fact is missing or marked TBD, ask the human before proceeding.

Do not put account IDs, access keys, session tokens or secret values in this file.

## 1. Account type and rules
| Item | Value |
|---|---|
| Account kind | AWS Workshop Studio participant account (temporary) |
| Region | us-west-2 (Oregon). All resources go here unless stated |
| Account expires | TBD (ask organizers; date and time) |
| Resources deleted after the event? | TBD (yes / no / grace period) |
| Credits cover Bedrock third-party models? | TBD |
| Credits cover AWS Marketplace? | TBD (assume NO) |
| Who can request a quota or permission increase | TBD (organizer contact) |

## 2. How Claude Code authenticates
- Temporary credentials from the Workshop Studio event page ("Get AWS CLI credentials"), exported as environment variables in the shell where Claude Code runs, or stored in a named profile `hackathon`.
- They expire. If a command fails with ExpiredToken or AccessDenied on something that worked earlier, STOP and ask the human to refresh credentials. Never try to work around it.
- Never print, log or commit credentials.
- Fallback: AWS CloudShell in the console (has credentials automatically) for running deploys.

## 3. Decisions (fill in, then freeze)
| Decision | Choice |
|---|---|
| Database | TBD: DynamoDB (all-AWS, recommended) or MongoDB Atlas M0 (free, outside AWS) |
| Infrastructure as code | TBD: Terraform, AWS CDK, or AWS SAM. Pick based on the IAM and CloudFormation results in section 4 |
| Deploy from | TBD: local machine or CloudShell. (GitHub Actions to AWS needs an OIDC role; likely not possible here) |
| Web hosting | TBD: Amplify Hosting or S3 + CloudFront |
| Naming | `clearpath-<env>-<thing>`, env = `dev` |
| Tags on every resource | `Project=clearpath`, `Env=dev`, `Owner=<name>` |

## 4. What the preflight script found
Run `bash scripts/aws-preflight.sh | tee preflight-report.txt` and summarize here. Mark each Allowed / Blocked / Untested.

| Capability | Status | Notes |
|---|---|---|
| Credentials work | | |
| Bedrock: Anthropic models listed | | |
| Bedrock: model invoke works | | exact ID used: |
| Transcribe Medical | | |
| Comprehend Medical | | |
| Polly neural voices (es-US etc.) | | |
| S3: create, encrypt, CORS, lifecycle | | |
| DynamoDB: create, TTL | | |
| KMS: list keys (can we create our own?) | | |
| Secrets Manager / SSM Parameter Store | | |
| IAM: create role | | If blocked, we need a pre-provided Lambda execution role ARN: TBD |
| Lambda | | |
| API Gateway (REST / HTTP) | | |
| Cognito user pools | | |
| Step Functions | | |
| EventBridge rules / Scheduler | | |
| Amplify / CloudFront | | |
| CloudFormation (needed by CDK and SAM) | | |
| CloudWatch Logs | | |
| SNS / SES | | |
| WAF | | |

## 5. Bedrock details
| Item | Value |
|---|---|
| Model for simplify / translate | TBD (exact model or inference-profile ID from the console) |
| Model for chat | TBD |
| Model for back-translation compare (can be smaller) | TBD |
| Guardrail ID (optional) | TBD |
| Observed rate limits (requests/min, tokens/min) | TBD |

## 5b. Service fallbacks if something is blocked
| If blocked | Fallback |
|---|---|
| Transcribe Medical | Standard Transcribe with custom vocabulary, or MODEL_MODE-style mock using a canned transcript |
| Comprehend Medical | Rule-based drug/dose extraction from the source text |
| Polly | Browser SpeechSynthesis |
| Cognito | Simple signed-cookie login with a seeded demo user (label it as demo-only) |
| Step Functions | Run steps sequentially in one Lambda |
| IAM role creation | Use the pre-provided role ARN from section 4 |
| Amplify | S3 static hosting + CloudFront, or run the web app locally for the demo |
| SES / SNS | Mock mode (SMS_MODE=mock) |

## 6. Secrets (humans create these, Claude Code only reads them at runtime)
| Secret | Where | Created by |
|---|---|---|
| Patient session signing secret | SSM Parameter Store SecureString `/clearpath/dev/session-signing-secret` | Human, `openssl rand -base64 48` |
| (If Atlas) MongoDB connection string | SSM SecureString `/clearpath/dev/mongodb-uri` | Human |
| (If Anthropic API instead of Bedrock) API key | SSM SecureString `/clearpath/dev/anthropic-api-key` | Human |

## 7. Rules for Claude Code in this account
1. Only create resources named and tagged as above. Never touch resources it did not create.
2. Never run destructive commands (delete, terminate, empty bucket) without telling the human what will be removed.
3. Keep everything reproducible: all infrastructure in code, a single `scripts/deploy.sh` and `scripts/destroy.sh`.
4. Prefer pay-per-use services. No always-on instances, no NAT gateways, no interface VPC endpoints for the hackathon.
5. After each deploy, print the resource names and URLs it created, and a rough list of what costs money.
6. Synthetic data only.
