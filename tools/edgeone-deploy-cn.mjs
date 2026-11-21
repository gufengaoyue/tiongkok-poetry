#!/usr/bin/env node
/**
 * Deploy the built EdgeOne ZIP into a mainland-area Makers project.
 *
 * The global-area project cannot bind an ICP-filed .cn domain, so this keeps a
 * separate mainland project on the same EdgeOne account. The token itself is
 * always kept in GitHub Actions secrets.
 */
import { existsSync } from 'node:fs';
import { Makers } from '@edgeone/makers-sdk';

const token = process.env.EDGEONE_API_TOKEN;
const projectName = process.env.EDGEONE_CN_PROJECT || 'tiongkok-poetry-cn';
const zipPath = process.env.EDGEONE_ZIP || 'molan-edgeone.zip';

if (!token) {
  console.error('EDGEONE_API_TOKEN is required');
  process.exit(1);
}
if (!existsSync(zipPath)) {
  console.error(`Deployment ZIP not found: ${zipPath}`);
  process.exit(1);
}

const makers = new Makers({ token, region: 'china' });

try {
  const projects = await makers.projects.list({ name: projectName, pageSize: 50 });
  let project = projects.items.find((item) => item.name === projectName);

  if (!project) {
    const created = await makers.projects.create({ name: projectName, area: 'mainland' });
    console.log(`::notice title=EdgeOne mainland::created project=${projectName} projectId=${created.projectId}`);
    project = { projectId: created.projectId, name: projectName, area: 'mainland' };
  }

  const detail = await makers.projects.get({ projectId: project.projectId });
  if (detail.area && detail.area !== 'mainland') {
    throw new Error(`Project ${projectName} has area=${detail.area}, expected mainland`);
  }

  console.log(`::notice title=EdgeOne mainland::project=${projectName} area=${detail.area || 'mainland'} preset=${detail.presetDomain || 'unknown'}`);

  const deployment = await makers.deployments.deploy({
    projectId: project.projectId,
    artifact: { archive: zipPath },
    env: 'Production',
    wait: true,
    timeout: 900,
    pollInterval: 10,
    onStatusChange: ({ deployment: current }) => {
      console.log(`::notice title=EdgeOne mainland deployment::status=${current.status || 'unknown'} id=${current.deploymentId || ''}`);
    },
  });

  const result = {
    project: projectName,
    projectId: project.projectId,
    area: detail.area || 'mainland',
    presetDomain: detail.presetDomain || null,
    deploymentId: deployment.deploymentId,
    status: deployment.status,
    previewUrl: deployment.previewUrl || null,
  };
  console.log(JSON.stringify(result, null, 2));
  console.log(`::notice title=EdgeOne mainland ready::project=${projectName} status=${deployment.status || 'unknown'} url=${deployment.previewUrl || detail.presetDomain || 'unknown'}`);

  const summary = [
    '### EdgeOne 中国大陆项目',
    '',
    `- 项目：\`${projectName}\``,
    `- 加速区域：\`${result.area}\``,
    `- 预设域名：${result.presetDomain || '控制台查看'}`,
    `- 部署：\`${result.deploymentId}\` / ${result.status || '未知'}`,
    `- 访问地址：${result.previewUrl || result.presetDomain || '控制台查看'}`,
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = await import('node:fs');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  }
} catch (error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(message);
  console.log(`::error title=EdgeOne mainland::${message.replace(/\r?\n/g, ' ').slice(0, 900)}`);
  process.exit(1);
}
