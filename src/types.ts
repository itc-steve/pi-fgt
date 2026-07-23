/** Shared types for pi-fgt. */

export interface DeviceConfig {
  url: string;
  tokenEnv: string;
  vdom?: string;
  verifySsl?: boolean;
}

/** Session start default for FortiGate tools. "off" = must /fortigate on each new session. */
export type SessionDefault = "on" | "off";

export interface FortiConfig {
  maxResponseBytes?: number;
  /**
   * Whether FortiGate tools are active at session_start.
   * Default: "off" — use `/fortigate on` each new session.
   */
  sessionDefault?: SessionDefault;
  devices: Record<string, DeviceConfig>;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  details?: Record<string, unknown>;
}

export interface BoundedEnvelope {
  _truncated?: boolean;
  _returned?: number;
  _total?: number;
  _bytes_cap?: number;
  _hint?: string;
  _original_bytes?: number;
  preview?: string;
  data?: any;
}

export const POLICY_KEEP = new Set([
  "policyid", "name", "srcintf", "dstintf", "srcaddr", "dstaddr",
  "service", "action", "status", "schedule", "nat", "logtraffic",
  "utm-status", "comments",
]);

export const ADDRESS_KEEP = new Set([
  "name", "type", "subnet", "start-ip", "end-ip", "fqdn", "country",
  "interface", "associated-interface", "comment",
]);

export const ADDRGRP_KEEP = new Set(["name", "member", "comment"]);

export const SERVICE_KEEP = new Set([
  "name", "protocol", "tcp-portrange", "udp-portrange", "sctp-portrange",
  "icmptype", "category", "comment",
]);

export const VIP_KEEP = new Set([
  "name", "type", "extip", "extintf", "mappedip", "portforward",
  "protocol", "extport", "mappedport", "comment",
]);

export const ROUTE_KEEP = new Set([
  "seq-num", "dst", "gateway", "device", "distance", "priority",
  "status", "comment",
]);

export const ADMIN_KEEP = new Set([
  "name", "accprofile", "trusthost1", "trusthost2", "vdom",
  "remote-auth", "two-factor", "comments",
]);

export const PHASE1_KEEP = new Set([
  "name", "interface", "ike-version", "remote-gw", "proposal", "dhgrp",
  "authmethod", "peertype", "net-device", "comments",
]);

export const PHASE2_KEEP = new Set([
  "name", "phase1name", "proposal", "src-subnet", "dst-subnet",
  "auto-negotiate", "comments",
]);

export const FORTIAP_KEEP = new Set([
  "name", "serial", "wtp_id", "status", "state", "clients",
  "local_ipv4_addr", "connecting_from", "connecting_interface",
  "board_mac", "join_time", "os_version", "ap_profile", "cpu_usage",
]);

export const WIFI_CLIENT_KEEP = new Set([
  "mac", "ip", "ssid", "vap_name", "wtp_id", "wtp_name", "wtp_ip",
  "hostname", "manufacturer", "os", "signal", "snr", "noise", "channel",
  "vlan_id", "radio_type", "mimo", "bandwidth_tx", "bandwidth_rx",
]);

export const FORTISWITCH_KEEP = new Set([
  "switch-id", "serial", "status", "state", "connecting_from",
  "join_time", "os_version", "fgt_peer_intf_name", "max_poe_budget", "type",
]);

export const SWITCH_PORT_KEEP = new Set([
  "interface", "status", "speed", "duplex", "vlan", "fortilink_port",
  "fgt_peer_port_name", "fgt_peer_device_name", "poe_status", "poe_capable",
  "port_power",
]);

export const ALLOWED_PROFILE_TYPES: Record<string, string> = {
  "antivirus": "antivirus/profile",
  "ips": "ips/sensor",
  "webfilter": "webfilter/profile",
  "application": "application/list",
  "dnsfilter": "dnsfilter/profile",
  "ssl-ssh": "firewall/ssl-ssh-profile",
  "file-filter": "file-filter/profile",
  "emailfilter": "emailfilter/profile",
};

export const ALLOWED_LOG_SOURCES = new Set(["memory", "disk", "fortianalyzer", "forticloud"]);
export const ALLOWED_LOG_TYPES = new Set([
  "traffic", "event", "utm", "virus", "webfilter", "ips",
  "anomaly", "app-ctrl", "dlp", "emailfilter",
]);

export const PER_PAGE_CAP = 50;
/** Default tool output cap (~6–8k tokens). Was 120k and blew model context. */
export const DEFAULT_MAX_RESPONSE_BYTES = 24000;
