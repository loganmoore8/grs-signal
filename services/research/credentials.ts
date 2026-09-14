import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { OpenAIResearch } from './provider';
export async function configuredResearch() {
  const secretId = process.env.OPENAI_SECRET_ID || 'grs-signal/openai';
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-west-2' });
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const key = result.SecretString?.trim();
  if (!key || !key.startsWith('sk-') || /\s/.test(key))
    throw new Error('Save an OpenAI API key as the plaintext value of the configured secret');
  return new OpenAIResearch(key);
}
