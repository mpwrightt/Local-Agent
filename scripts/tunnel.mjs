#!/usr/bin/env node
import crypto from 'node:crypto'
import ngrok from 'ngrok'

async function main() {
  const authtoken = process.env.NGROK_AUTHTOKEN
  if (!authtoken) {
    console.error('NGROK_AUTHTOKEN not set. Get one from https://dashboard.ngrok.com/get-started/your-authtoken')
    process.exit(1)
  }
  const region = process.env.NGROK_REGION || 'us'
  const agentToken = process.env.AGENT_TOKEN || crypto.randomBytes(16).toString('hex')

  console.log('[tunnel] starting...')
  const lmUrl = await ngrok.connect({ addr: 1234, authtoken, region, proto: 'http' })
  const agentUrl = await ngrok.connect({ addr: 8787, authtoken, region, proto: 'http' })

  console.log('\nTunnels ready:')
  console.log(`  LM Studio:  ${lmUrl}`)
  console.log(`  Agent API:  ${agentUrl}`)

  console.log('\nUse these settings:')
  console.log(`  Vercel env LM_PROXY_BASE=${lmUrl}`)
  console.log(`  Agent server token (AGENT_TOKEN)=${agentToken}`)
  console.log('\nRun the agent server (in another terminal):')
  console.log('  AGENT_TOKEN=' + agentToken + ' npm run agent:serve')

  console.log('\nPress Ctrl+C to stop tunnels.')
}

main().catch((e) => { console.error(e); process.exit(1) })


