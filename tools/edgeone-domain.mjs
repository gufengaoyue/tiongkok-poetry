#!/usr/bin/env node
/**
 * Ensure the production custom domain exists on the EdgeOne Makers project.
 * Runs with EDGEONE_API_TOKEN; never commits or prints the token.
 */
import { Makers } from '@edgeone/makers-sdk';

const token = process.env.EDGEONE_API_TOKEN;
const projectName = process.env.EDGEONE_PROJECT || 'tiongkok-poetry';
const wantedDomain = process.env.EDGEONE_DOMAIN || 'tiongkok-poetry.icu';
const region = process.env.EDGEONE_REGION || undefined;

if (!token) {
  console.error('EDGEONE_API_TOKEN is required');
  process.exit(1);
}

const makers = new Makers(region ? { token, region } : { token });

try {
  const projects = await makers.projects.list({ name: projectName, pageSize: 50 });
  const project = projects.items.find((item) => item.name === projectName);
  if (!project) {
    throw new Error(`EdgeOne project not found: ${projectName}; available: ${projects.items.map((p) => p.name).join(', ')}`);
  }

  const detail = await makers.projects.get({ projectId: project.projectId });
  console.log(`::notice title=EdgeOne context::region=${makers.region || 'auto'} project=${project.name} area=${detail.area || project.area || 'unknown'} preset=${detail.presetDomain || 'unknown'}`);
  let domains = await makers.domains.list({ projectId: project.projectId });
  let domain = domains.find((item) => item.domain === wantedDomain);

  if (!domain) {
    await makers.domains.create({ projectId: project.projectId, domain: wantedDomain });
    domains = await makers.domains.list({ projectId: project.projectId });
    domain = domains.find((item) => item.domain === wantedDomain);
  }

  if (!domain) {
    throw new Error(`Domain was not created: ${wantedDomain}`);
  }

  const verification = domain.ownershipVerification?.dnsVerification || null;
  const result = {
    project: {
      projectId: project.projectId,
      name: project.name,
      area: detail.area || project.area || null,
      presetDomain: detail.presetDomain || null,
    },
    domain: {
      domain: domain.domain,
      status: domain.status,
      cname: domain.cname || null,
      currentCname: domain.currentCname || null,
      mainDomain: domain.mainDomain || null,
      verification,
    },
  };

  console.log(JSON.stringify(result, null, 2));
  const notice = [
    `project=${result.project.name}`,
    `area=${result.project.area || 'unknown'}`,
    `preset=${result.project.presetDomain || 'unknown'}`,
    `domain=${result.domain.domain}`,
    `status=${result.domain.status || 'pending'}`,
    `cname=${result.domain.cname || 'pending'}`,
    verification?.recordType && verification?.recordValue
      ? `txt=${verification.subdomain || '@'}:${verification.recordValue}`
      : 'txt=pending',
  ].join(' | ');
  console.log(`::notice title=EdgeOne domain::${notice}`);

  const lines = [
    '### EdgeOne 自定义域名',
    '',
    `- 项目：\`${result.project.name}\`（${result.project.projectId}）`,
    `- 加速区域：${result.project.area || '未知'}`,
    `- 默认域名：${result.project.presetDomain || '控制台查看'}`,
    `- 自定义域名：\`${result.domain.domain}\``,
    `- 状态：${result.domain.status || '待验证'}`,
    '',
    '#### DNS 记录',
    '',
    '| 类型 | 主机记录 | 记录值 |',
    '| --- | --- | --- |',
  ];

  if (verification?.recordType && verification?.recordValue) {
    lines.push(`| ${verification.recordType} | ${verification.subdomain || '@'} | ${verification.recordValue} |`);
  }
  if (result.domain.cname) {
    lines.push(`| CNAME | ${result.domain.domain} | ${result.domain.cname} |`);
  }

  lines.push('', '> TXT 归属验证生效后再添加 CNAME；控制台点击“验证归属权”并等待证书签发。');
  const summary = lines.join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = await import('node:fs');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  }
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const singleLine = message.replace(/\r?\n/g, ' ').slice(0, 900);
  console.error(message);
  console.log(`::error::${singleLine}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = await import('node:fs');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Domain bind failed\n\n\`${singleLine}\`\n`);
  }
  process.exit(1);
}

