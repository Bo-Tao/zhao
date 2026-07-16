import { getFrecencyScore } from "./frecency.js";
import type {
  DomainCandidate,
  MergedProject,
  RankedProject,
  ZhaoState,
} from "./types.js";

const EMPTY_STATE: ZhaoState = { version: 1, entries: {} };

const normalize = (value: string): string =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

const isSubsequence = (needle: string, haystack: string): boolean => {
  let cursor = 0;
  for (const character of haystack) {
    if (character === needle[cursor]) {
      cursor += 1;
    }
    if (cursor === needle.length) {
      return true;
    }
  }
  return needle.length > 1 && cursor === needle.length;
};

const domainScore = (
  domain: DomainCandidate,
  query: string,
): { score: number; reason: string } | undefined => {
  const value = normalize(domain.value);
  const labels: Record<DomainCandidate["type"], string> = {
    page: "页面域名",
    api: "API 域名",
    guess: "猜测域名",
  };
  const weights: Record<DomainCandidate["type"], number> = {
    page: 140,
    api: 125,
    guess: 90,
  };

  if (value === query) {
    return {
      score: weights[domain.type] * domain.confidence,
      reason: `${labels[domain.type]}精确匹配 ${domain.value}`,
    };
  }
  if (value.startsWith(query) || query.startsWith(`${value}.`)) {
    return {
      score: weights[domain.type] * 0.78 * domain.confidence,
      reason: `${labels[domain.type]}前缀匹配 ${domain.value}`,
    };
  }
  if (value.includes(query)) {
    return {
      score: weights[domain.type] * 0.55 * domain.confidence,
      reason: `${labels[domain.type]}包含 ${domain.value}`,
    };
  }
  return undefined;
};

const scoreProject = (
  project: MergedProject,
  query: string,
): { score: number; reason: string } | undefined => {
  const candidates: Array<{ score: number; reason: string }> = [];

  for (const domain of project.domains) {
    const scored = domainScore(domain, query);
    if (scored) {
      candidates.push(scored);
    }
  }

  for (const alias of project.aliases) {
    const value = normalize(alias);
    if (value === query) {
      candidates.push({ score: 115, reason: `别名精确匹配 ${alias}` });
    } else if (value.includes(query)) {
      candidates.push({ score: 75, reason: `别名包含 ${alias}` });
    }
  }

  for (const keyword of project.manualKeywords) {
    const value = normalize(keyword);
    if (value === query) {
      candidates.push({ score: 95, reason: `手动关键词匹配 ${keyword}` });
    } else if (value.includes(query)) {
      candidates.push({ score: 68, reason: `手动关键词包含 ${keyword}` });
    }
  }

  const name = normalize(project.name);
  if (name === query) {
    candidates.push({ score: 88, reason: `项目名精确匹配 ${project.name}` });
  } else if (name.includes(query)) {
    candidates.push({ score: 58, reason: `项目名包含 ${project.name}` });
  } else if (isSubsequence(query, name)) {
    candidates.push({ score: 18, reason: `项目名模糊匹配 ${project.name}` });
  }

  const description = normalize(project.description);
  if (description.includes(query)) {
    candidates.push({ score: 38, reason: "项目描述匹配" });
  }

  for (const keyword of [...project.keywords, ...project.stack]) {
    const value = normalize(keyword);
    if (value === query) {
      candidates.push({ score: 48, reason: `自动关键词匹配 ${keyword}` });
    } else if (value.includes(query)) {
      candidates.push({ score: 30, reason: `自动关键词包含 ${keyword}` });
    }
  }

  return candidates.sort((left, right) => right.score - left.score)[0];
};

export const rankProjects = (
  projects: MergedProject[],
  rawQuery: string,
  state: ZhaoState = EMPTY_STATE,
  now = new Date(),
): RankedProject[] => {
  const query = normalize(rawQuery);
  if (!query) {
    return [];
  }

  return projects
    .map((project) => {
      const match = scoreProject(project, query);
      if (!match) {
        return undefined;
      }
      return {
        project,
        score: match.score + getFrecencyScore(project.id, state, now),
        reason: match.reason,
      };
    })
    .filter((result): result is RankedProject => Boolean(result))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.project.name.localeCompare(right.project.name, "zh-CN"),
    );
};
