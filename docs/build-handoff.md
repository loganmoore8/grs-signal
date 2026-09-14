# Local build handoff — 2026-09-13 PT

The local MVP is ready for deployment configuration and a real Terraform plan. Nothing has been applied to AWS, no real emails were sent, and no paid research was run.

| Check                                    | Result                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| TypeScript checks                        | Passed                                                                                                                   |
| Automated tests                          | 61 passed across 5 files, including 30 labeled qualification scenarios                                                   |
| Formatting                               | Passed                                                                                                                   |
| Production Next.js static export         | Passed                                                                                                                   |
| Lambda bundle/ZIP packaging              | Passed                                                                                                                   |
| Terraform formatting and validation      | Passed, no warnings                                                                                                      |
| npm audit                                | 0 reported vulnerabilities                                                                                               |
| Browser acceptance                       | Desktop and 390px mobile; detail drawer, notes, pursue, pass, restore, nested Escape handling, and agency search checked |
| Local scheduled-research simulation      | Passed; meaningful email captured locally                                                                                |
| Production artifact fixture-marker check | No fictional fixture payloads found                                                                                      |

## Artifacts

Generated locally and ignored by git:

| Artifact            |  Bytes | SHA-256                                                            |
| ------------------- | -----: | ------------------------------------------------------------------ |
| `dist/api.zip`      | 423764 | `5b088931c137b5b4fe4f1625d7542e4349526eeac5c7801391333f1fb26d974d` |
| `dist/research.zip` | 624990 | `904ce960fab26c119a1b697592475192c1937b0bb06f6072a168a4d694eee174` |

`dist/manifest.json` is regenerated with each build. Rebuild and replan if code or inputs change. Static hosting output is `apps/web/out`.

## Reproduce

Use Node 22.14+:

```sh
npm ci
npm run check
npm run lint
npm run build
terraform -chdir=infra init -backend=false
terraform -chdir=infra fmt -check -recursive
terraform -chdir=infra validate
```

Launch the fictional preview with `npm run dev`, or `scripts/dev.ps1` on this machine. Open `http://127.0.0.1:3000`. Browser acceptance is recorded above; it is not part of an automated browser-test command.

The initial source delivery targets [loganmoore8/grs-signal](https://github.com/loganmoore8/grs-signal) on `codex/initial-build`. See [the next-chat handover](NEXT-CHAT-HANDOVER.md) for current UI decisions, local startup and remaining deployment inputs. Use git history and remote refs to verify the current delivery revision.

## Remaining gate

Follow [the runbook](runbook.md) for the saved plan, final apply, secret/user setup, hosted release and live checks. [Implementation status](implementation-status.md) records MVP limits. [The pilot report](pilot-report.md) remains pending: live source accuracy, model capability enforcement, real AWS behavior, and the approximately $2/day combined cost target are unverified.
