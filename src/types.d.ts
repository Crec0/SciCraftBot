import { IssueObject } from "jira-client";

export class Config {
    token: string;
    guild: string;
    host: string;
    user: string;
    password: string;
    prefix: string;
    url: string;
    name: string;
    colors: StatusColor;
    modlog: string;
    maxIssuesBeforePagination: number;
    maxBugsPerMessage: number;
    keepThreadsAlive?: boolean;
    cleanupStreams?: CleanupStreams;
    mediaOnly?: UrlOnly;
    linksOnly?: UrlOnly;
    minecraftVersion?: MinecraftVersion;
}

export class CleanupStreams {
    twitchApiClientID: string;
    twitchApiClientSecret: string;
    channels: string[];
    gracePeriod: number;
}

export class UrlOnly {
    ignoreRoles: string[];
    ignorePermissions: string[];
    channels: string[];
}

export class MinecraftVersion {
    channels: string[];
    webhook: string;
    interval?: number;
}

export class StatusColor {
    [name: string]: number
}

export class Paginator {
    title: string;
    issues: IssueObject[];
    currentPage: number;
}

export class Manifest {
    latest: {
        release: string;
        snapshot: string;
    };
    versions: VersionInfo[];
}

export class VersionInfo {
    id: string;
    type: string;
    url: string;
    time: string;
    releaseTime: string;
}

export class VersionManifest {
    arguments: unknown;
    assetIndex: {
        id: string;
        sha1: string;
        size: number;
        totalSize: number;
        url: string;
    }
    assets: string;
    complianceLevel: number;
    downloads: {
        client: Jar,
        client_mappings: Mappings,
        server: Jar,
        server_mappings: Mappings
    };
    id: string;
    javaVersion: {
        component: string;
        majorVersion: number;
    }
    libraries: any;
    logging: any;
    mainClass: string;
    minimumLauncherVersion: number;
    releaseTime: Date;
    time: Date;
    type: string;
}

declare class Jar {
    sha1: string;
    size: number;
    url: string;
}

declare class Mappings {
    sha1: string;
    size: number;
    url: string;
}