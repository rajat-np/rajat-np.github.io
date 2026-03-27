/**
 * Skills and Technology Badges
 *
 * Copyright (c) 2018-present Rajat Soni
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information
 */

export interface Badge {
  name: string;
  badge: string;
  url?: string;
}

export const languages: Badge[] = [
  {
    name: "Python",
    badge: "https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white",
    url: "https://www.python.org/",
  },
  {
    name: "JavaScript",
    badge: "https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
  },
  {
    name: "Golang",
    badge: "https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white",
    url: "https://go.dev/",
  }
];

export const frameworks: Badge[] = [
  {
    name: "React",
    badge: "https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=111",
    url: "https://react.dev/",
  },
  {
    name: "Node.js",
    badge: "https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white",
    url: "https://nodejs.org/en/docs",
  },
  {
    name: "FastAPI",
    badge: "https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white",
    url: "https://fastapi.tiangolo.com/",
  },
  {
    name: "Flask",
    badge: "https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white",
    url: "https://flask.palletsprojects.com/",
  },
  {
    name: "Django",
    badge: "https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white",
    url: "https://docs.djangoproject.com/",
  },
  {
    name: "Airflow",
    badge: "https://img.shields.io/badge/Airflow-017CEE?style=for-the-badge&logo=apacheairflow&logoColor=white",
    url: "https://airflow.apache.org/",
  },
];

export const databases: Badge[] = [
  {
    name: "PostgreSQL",
    badge: "https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white",
    url: "https://www.postgresql.org/",
  },
  {
    name: "MongoDB",
    badge: "https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white",
    url: "https://www.mongodb.com/",
  },
  {
    name: "Elasticsearch",
    badge: "https://img.shields.io/badge/Elasticsearch-005571?style=for-the-badge&logo=elasticsearch&logoColor=white",
    url: "https://www.elastic.co/",
  },
  {
    name: "Redis",
    badge: "https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white",
    url: "https://redis.io/",
  },
];

export const cloud: Badge[] = [
  {
    name: "AWS",
    badge: "https://img.shields.io/badge/AWS-232F3E?style=for-the-badge&logo=amazonaws&logoColor=white",
    url: "https://aws.amazon.com/",
  },
  {
    name: "GCP",
    badge: "https://img.shields.io/badge/GCP-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white",
    url: "https://cloud.google.com/",
  },
  {
    name: "Docker",
    badge: "https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white",
    url: "https://docs.docker.com/",
  },
  {
    name: "GitHub Actions",
    badge: "https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white",
    url: "https://docs.github.com/en/actions",
  },
];

export const ides: Badge[] = [
  {
    name: "Linux",
    badge: "https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=111",
    url: "https://www.linux.org/",
  },
  {
    name: "VS Code",
    badge: "https://img.shields.io/badge/VS_Code-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white",
    url: "https://code.visualstudio.com/",
  },
  {
    name: "Git",
    badge: "https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white",
    url: "https://git-scm.com/",
  },
];

export const ai: Badge[] = [
  {
    name: "Cursor",
    badge: "https://img.shields.io/badge/Cursor-000000?style=for-the-badge&logo=cursor&logoColor=white",
    url: "https://www.cursor.com/",
  },
  {
    name: "Claude",
    badge: "https://img.shields.io/badge/Claude-000000?style=for-the-badge&logo=claude&logoColor=white",
    url: "https://claude.ai/",
  },
  {
    name: "Agentic workflows",
    badge: "https://img.shields.io/badge/Agentic_Workflows-000000?style=for-the-badge&logo=agenticworkflows&logoColor=white",
  },
  {
    name: "MCP server",
    badge: "https://img.shields.io/badge/MCP-000000?style=for-the-badge&logo=mcp&logoColor=white",
  }
];  
