import type { getPublicSkill } from '../services/skill-registry.js';

type PublicSkill = Awaited<ReturnType<typeof getPublicSkill>>;

export function buildSkillDocumentation(skill: PublicSkill, origin: string) {
  return {
    schemaVersion: 'markgit.skill-docs/v1' as const,
    skill,
    safety: {
      sourceHosted: true,
      autoInstall: false,
      guidance: 'Inspect the source, bundled scripts, and license before installation. Markgit is an index and does not execute skill code.',
    },
    documentation: {
      metadata: `${origin}/v1/registry/skills/${skill.slug}`,
      json: `${origin}/v1/registry/skills/${skill.slug}/docs`,
      llms: `${origin}/v1/registry/skills/${skill.slug}/llms.txt`,
      human: `https://markgit.com/skills/${skill.slug}`,
      source: skill.source.url,
    },
  };
}

export function buildSkillLlmsText(skill: PublicSkill, origin: string) {
  const commands = Object.entries(skill.installation.commands)
    .map(([client, command]) => `- ${client}: ${command}`)
    .join('\n');
  return `# ${skill.name}\n\n${skill.description ?? ''}\n\n- Kind: skill\n- Format: ${skill.format}\n- Compatibility: ${skill.compatibility.join(', ')}\n- Publisher: ${skill.provenance.publisher ?? skill.provider.name}\n- Source: ${skill.source.url}\n- Revision: ${skill.source.revision}\n- Markgit charge: free\n- Auto-install: no\n\n## Installation commands\n${commands || '- See the source repository.'}\n\n## Machine-readable metadata\n${origin}/v1/registry/skills/${skill.slug}/docs\n`;
}

export function buildSkillRegistryLlmsText(skills: PublicSkill[], origin: string) {
  const entries = skills.map((skill) => `- ${skill.slug}: ${skill.name} — ${skill.description ?? ''} (${origin}/v1/registry/skills/${skill.slug}/docs)`).join('\n');
  return `# Skills\n\nSource-hosted SKILL.md packages. Review source and license before installation. Markgit does not execute them.\n\n${entries || '- No public skills currently listed.'}\n`;
}
