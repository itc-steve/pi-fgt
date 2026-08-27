/**
 * Default response filters — SINGLE SOURCE OF TRUTH.
 *
 * fortigate-filters.example.json is generated from this object
 * (`npm run filters:example`). Never hand-edit the JSON.
 *
 * Users override by copying it to ~/.pi/agent/fortigate-filters.json.
 * A user file is merged over these defaults (deep merge, per-key).
 */

export interface DropEmptyRules {
	emptyString?: boolean;
	emptyArray?: boolean;
	emptyObject?: boolean;
	nullValue?: boolean;
}

export interface DropValueRules {
	byValue?: string[];
	disableDefaults?: boolean;
}

export interface RuleBlock {
	dropEmpty?: DropEmptyRules;
	dropValues?: DropValueRules;
	dropKeys?: string[];
	dropPrefixes?: string[];
	dropSuffixes?: string[];
}

export interface FilterGroup {
	exclude: boolean;
	why: string;
	keys?: string[];
	prefixes?: string[];
	suffixes?: string[];
	/** health:{x:{value,severity}} → x_severity instead of dropping outright. */
	flatten?: boolean;
}

export interface ToolOverride extends RuleBlock {
	/** Keys that survive every drop rule for this tool. */
	keep?: string[];
	/** Per-tool group on/off, e.g. { session_forensics: false }. */
	groups?: Record<string, boolean>;
	/**
	 * STRICT ALLOWLIST: when set, only these fields plus keep[] are returned.
	 * Empty/absent = no allowlist (rules-only filtering).
	 * Set to null in your config to disable the allowlist and see all fields.
	 */
	allowlist?: string[] | null;
}

export interface FilterConfig {
	enabled: boolean;
	global: RuleBlock;
	groups: Record<string, FilterGroup>;
	tools: Record<string, ToolOverride>;
	limits: {
		maxResponseBytes?: number | null;
		/** Arrays longer than this are trimmed when a payload is over budget. */
		maxArrayItems?: number;
		/** Max follow-up API calls a tool may fan out (get_fqdn_addresses). */
		maxExpandRequests?: number;
	};
	audit: {
		annotate: boolean;
		verboseBypassesFilters: boolean;
	};
}

const POLICY_ALLOW = [
	"policyid", "name", "srcintf", "dstintf", "srcaddr", "dstaddr",
	"service", "action", "status", "schedule", "nat", "poolname",
	"traffic-shaper", "traffic-shaper-reverse", "per-ip-shaper",
	"logtraffic", "utm-status",
	"inspection-mode", "profile-group",
	"ssl-ssh-profile", "av-profile", "webfilter-profile",
	"dnsfilter-profile", "ips-sensor", "application-list", "comments",
];

export const DEFAULT_FILTERS: FilterConfig = {
	enabled: true,

	global: {
		dropEmpty: {
			emptyString: true,
			emptyArray: true,
			emptyObject: true,
			nullValue: true,
		},
		dropValues: {
			byValue: ["0.0.0.0", "0.0.0.0 0.0.0.0", "::", "::/0", "00:00:00:00:00:00", "Reserved"],
			disableDefaults: false,
		},
		dropKeys: ["q_origin_key"],
		dropPrefixes: [],
		dropSuffixes: [],
	},

	groups: {
		uuid: {
			exclude: true,
			why: "Opaque 128-bit IDs. Useless to humans; needed only for FortiManager / log correlation.",
			keys: ["uuid", "uuid-idx", "src_uuid", "dst_uuid", "src_uuid_type", "dst_uuid_type"],
		},
		ipv6: {
			exclude: true,
			why: "IPv6 config blocks on v4-only networks. ~1400 chars per interface.",
			keys: ["ipv6", "srcaddr6", "dstaddr6", "poolname6", "ip6", "ipv6_gateway"],
			prefixes: ["ip6-", "dhcp6-", "vrrp6", "vrip6", "internet-service6", "trust-ip6-"],
			suffixes: ["6-negate"],
		},
		ztna: {
			exclude: true,
			why: "Zero-trust fields present on every policy even when ZTNA is unlicensed.",
			prefixes: ["ztna-"],
		},
		qos: {
			exclude: true,
			why: "DiffServ / ToS / VLAN-CoS markers, almost always at defaults.",
			prefixes: ["diffserv", "tos", "vlan-cos-"],
		},
		legacy_dialup: {
			exclude: true,
			why: "PPTP / L2TP / PPPoE-LCP fields on interfaces. Dead protocols on modern edges.",
			prefixes: ["pptp-", "l2tp-", "lcp-", "pppoe-", "padt-", "disc-retry-", "ntlm"],
			keys: ["l2tp-client", "l2tp-client-settings", "ipunnumbered", "idle-timeout"],
		},
		nat_edge_cases: {
			exclude: true,
			why: "PCP, RTP pinholing, STUN permits — niche NAT knobs.",
			prefixes: ["pcp-", "rtp-"],
			keys: ["permit-any-host", "permit-stun-host", "wccp", "fec"],
		},
		negate_flags: {
			exclude: true,
			why: "srcaddr-negate, service-negate etc. Rarely enabled, 9 keys per policy.",
			suffixes: ["-negate"],
		},
		duplicate_identity: {
			exclude: true,
			why: "Fields verified to repeat a value already present under another key.",
			keys: [
				"wtp_name",
				"non_rc_gateway",
				"wtp_control_local_ip",
				"protocol_str",
			],
		},
		wifi_micro_telemetry: {
			exclude: true,
			why: "Per-client MCS index, rate scores, 802.11k/v/r flags. Only useful in deep RF debug.",
			keys: [
				"sta_rxrate_mcs",
				"sta_txrate_mcs",
				"sta_rxrate_score",
				"sta_txrate_score",
				"sta_maxrate",
				"11k_capable",
				"11v_capable",
				"11r_capable",
				"encrypt",
				"security",
				"captive_portal_authenticated",
				"uses_captive_portal",
				"lan_authenticated",
			],
		},
		wifi_rf_floor: {
			exclude: false,
			why: "noise / noise_floor. Kept ON — needed for real RF troubleshooting even though it is usually a constant -95.",
			keys: ["noise", "noise_floor"],
		},
		session_forensics: {
			exclude: false,
			why: "country, srcmac, dstmac on live sessions. Kept ON — geo triage and MAC<->IP correlation are normal ops tasks.",
			keys: ["country", "country_id", "srcmac", "dstmac"],
		},
		internal_ids: {
			exclude: true,
			why: "FortiOS-internal indexes with no operator meaning.",
			keys: [
				"server_mkey",
				"server_ipam_enabled",
				"devindex",
				"vindex",
				"snmp-index",
				"app_list_id",
				"swc-vlan",
				"swc-first-create",
				"internal",
				"vf",
				"cli-conn-status",
				"ping-serv-status",
			],
		},
		switch_controller_defaults: {
			exclude: true,
			why: "switch-controller-* on interfaces — 20 keys, all off unless FortiLink features are in use.",
			prefixes: ["switch-controller-"],
		},
		bfd_stp_lacp: {
			exclude: true,
			why: "Link-protocol tuning knobs at factory defaults.",
			prefixes: ["bfd", "stp", "lacp-", "fail-"],
			keys: [
				"min-links",
				"min-links-down",
				"algorithm",
				"link-up-delay",
				"aggregate-type",
				"system-id",
				"system-id-type",
			],
		},
		health_nesting: {
			exclude: false,
			flatten: true,
			why: "health:{x:{value,severity}} on APs/clients. flatten=true collapses to x_severity, keeping the verdict at ~60% of the bytes.",
			keys: ["health"],
		},

		// --- structural groups -------------------------------------------
		// These RESHAPE a payload (rename / derive / aggregate) rather than drop
		// keys, so they cannot be expressed as key lists. The tool code asks
		// groupEnabled(name); exclude:false returns the raw FortiOS structure.
		apps_compact: {
			exclude: true,
			why: "apps:[{id,name,protocol,protocol_str,port}] → [\"udp/53\"] on sessions/fortiview. exclude:false keeps the full app objects.",
		},
		resource_history: {
			exclude: true,
			why: "CPU/mem historical time series (hundreds of [ts,value] pairs per metric) collapsed to current + one sample. exclude:false returns the full series.",
		},
		switch_port_counts: {
			exclude: true,
			why: "get_fortiswitches ports[] replaced by port_count/ports_up. exclude:false returns every port inline (use get_switch_port_status instead).",
		},
		ipsec_compact: {
			exclude: true,
			why: "get_ipsec_tunnels proxyid[] trees → phase2[] selectors + derived up/down status. exclude:false returns raw tunnel records.",
		},
	},

	// allowlist = ONLY these fields come back; keep[] keys are also admitted.
	// These were hardcoded *_KEEP sets in src/types.ts before v1.3.0 — now
	// visible and editable. Set an allowlist to null to see every field.
	tools: {
		// IPv6-specific tools must not inherit the global v4-network noise rule.
		// Empty byValue also preserves valid :: and ::/0 routes/next hops.
		get_routing_table_ipv6: { groups: { ipv6: false }, dropValues: { byValue: [] } },
		get_bgp_neighbors_ipv6: { groups: { ipv6: false }, dropValues: { byValue: [] } },
		get_bgp_paths_ipv6: { groups: { ipv6: false }, dropValues: { byValue: [] } },
		get_policy_routes_ipv6: { groups: { ipv6: false }, dropValues: { byValue: [] } },
		get_sdwan_routes_ipv6: { groups: { ipv6: false }, dropValues: { byValue: [] } },
		get_firewall_acl6_stats: { groups: { ipv6: false }, dropValues: { byValue: [] } },
		// 0.0.0.0 is a valid on-link next hop in lookup results, not always noise.
		get_route_lookup: { keep: ["gateway"] },
		get_route_lookup_policy: { keep: ["gateway"] },
		get_firewall_policies: {
			dropValues: { disableDefaults: true },
			allowlist: POLICY_ALLOW,
		},
		get_firewall_policy: {
			dropValues: { disableDefaults: true },
			allowlist: POLICY_ALLOW,
		},
		get_interfaces_config: {
			dropValues: { disableDefaults: true },
			allowlist: [
				"name", "ip", "type", "vdom", "mode", "role", "status", "speed",
				"allowaccess", "alias", "description", "interface", "vlanid", "member",
				"vrf", "mtu",
			],
		},
		get_firewall_sessions: {
			allowlist: [
				"saddr", "sport", "daddr", "dport", "proto", "snaddr", "snport",
				"srcintf", "dstintf", "policyid", "policytype", "user",
				"expiry", "duration", "sentbyte", "rcvdbyte", "tx_packets", "rx_packets",
				"tx_shaper_drops", "rx_shaper_drops", "apps",
				"country", "srcmac", "dstmac",
			],
		},
		get_dhcp_leases: {
			allowlist: [
				"ip", "mac", "hostname", "interface", "reserved", "status",
				"ssid", "access_point", "expire_time", "vci",
			],
		},
		get_routing_table: {
			dropKeys: ["ip_version"],
			allowlist: [
				"ip_mask", "gateway", "interface", "type", "origin",
				"distance", "metric", "priority", "vrf",
			],
		},
		get_static_routes: {
			allowlist: [
				"seq-num", "dst", "gateway", "device", "distance",
				"priority", "status", "vrf", "blackhole", "comment",
			],
		},
		get_address_objects: {
			allowlist: [
				"name", "type", "subnet", "start-ip", "end-ip", "fqdn", "country",
				"wildcard", "macaddr", "interface", "associated-interface", "comment",
			],
		},
		get_address_groups: {
			allowlist: ["name", "member", "comment"],
		},
		get_service_objects: {
			allowlist: [
				"name", "protocol", "protocol-number", "tcp-portrange", "udp-portrange",
				"sctp-portrange", "icmptype", "category", "comment",
			],
		},
		get_vip_objects: {
			allowlist: [
				"name", "type", "status", "extip", "extintf", "mappedip", "portforward",
				"protocol", "extport", "mappedport", "server-type", "ldb-method",
				"realservers", "monitor", "comment",
			],
		},
		get_admin_accounts: {
			allowlist: [
				"name", "status", "accprofile", "trusthost1", "trusthost2", "vdom",
				"remote-auth", "two-factor", "comments",
			],
		},
		get_ipsec_phase1: {
			allowlist: [
				"name", "status", "interface", "ike-version", "remote-gw", "local-gw",
				"proposal", "dhgrp", "authmethod", "peertype", "net-device", "comments",
			],
		},
		get_ipsec_phase2: {
			allowlist: [
				"name", "phase1name", "proposal", "src-subnet", "dst-subnet",
				"auto-negotiate", "comments",
			],
		},
		get_policy_hit_counts: {
			// asic/software/nturbo splits: verbose path bypasses this allowlist.
			allowlist: [
				"policyid", "name", "comments", "active_sessions", "bytes", "packets", "hit_count",
			],
		},
		get_fortiview_statistics: {
			allowlist: [
				"srcaddr", "dstaddr", "sessions", "srcmac", "srcintf", "dstintf",
				"dst_port", "protocol", "sentbyte", "rcvdbyte",
				"tx_bandwidth", "rx_bandwidth", "user", "apps",
			],
		},
		get_fortiaps: {
			allowlist: [
				"name", "serial", "status", "state", "clients",
				// 7.6.7 renames local_ipv4_addr → local_addr; keep both for 7.4 boxes
				"local_ipv4_addr", "local_addr", "wtp_id", "connecting_interface", "board_mac",
				"join_time", "os_version", "ap_profile", "cpu_usage",
				"mem_free", "mem_total", "health", "last_failure",
				"last_reboot_time", "wan_status",
			],
		},
		get_wifi_clients: {
			allowlist: [
				"mac", "ip", "ssid", "vap_name", "wtp_id", "wtp_ip",
				// 7.6.7 renames hostname → host; keep both for 7.4 boxes
				"hostname", "host", "manufacturer", "os", "signal", "snr", "channel",
				"vlan_id", "radio_type", "wtp_radio", "mimo", "bandwidth_tx", "bandwidth_rx",
				"security_str", "authentication", "idle_time", "association_time",
				"sta_rxrate", "sta_txrate", "data_rate_bps", "data_rxrate_bps", "data_txrate_bps",
				"tx_discard_percentage", "tx_retry_percentage", "health",
				// kept because wifi_rf_floor is ON by default
				"noise",
			],
		},
		get_fortiswitches: {
			allowlist: [
				"switch-id", "serial", "status", "state", "connecting_from",
				"join_time", "os_version", "fgt_peer_intf_name",
				"max_poe_budget", "type", "port_count", "ports_up",
			],
		},
		get_logs: {
			// Keep row identity/verdict fields plus search completeness metadata.
			// Raw FAZ rows still contain many internal ids and duplicate labels.
			allowlist: [
				"date", "time", "action", "policyid", "level",
				"srcip", "srcport", "srcintf", "srcname",
				"dstip", "dstport", "dstintf", "dstname",
				"service", "proto", "app", "appcat", "duration",
				"sentbyte", "rcvdbyte", "user", "msg", "logdesc", "reason",
				"sessionid", "url", "hostname", "catdesc", "virus", "attack",
				"severity", "type", "subtype", "source", "log_type", "device", "policyname",
				"returned", "fetched", "ready", "completed", "percent_logs_processed",
				"total_lines", "polls", "session_id", "path", "category", "subcategory",
			],
		},
		get_interfaces_status: {
			allowlist: [
				"id", "name", "alias", "ip", "mask", "link", "speed", "duplex",
				"mac", "tx_bytes", "rx_bytes", "tx_packets", "rx_packets",
				"tx_errors", "rx_errors", "tx_dropped", "rx_dropped",
			],
		},
		get_available_licenses: {
			// Both the category names (top level) and the leaf fields inside them.
			// Categories left out here (appctrl, sms, …) are dropped whole.
			// 7.6.7: support_level is NOT a forticare leaf; it lives under
			// forticare.support.{hardware,enhanced,comprehensive}.{support_level,
			// status,expires}, so those wrapper keys must be allowlisted too or the
			// whole support/entitlement block is dropped.
			allowlist: [
				"fortiguard", "forticare", "antivirus", "ips", "web_filtering",
				"forticloud", "vdom",
				"support", "hardware", "enhanced", "comprehensive",
				"status", "connected", "has_connected", "expires",
				"support_level", "version", "used", "max", "can_upgrade",
				"registration_status", "account", "company",
			],
		},
		get_security_profiles: {
			allowlist: ["name", "comment"],
		},
		get_internet_service_basic: {
			allowlist: [
				"id", "name", "database", "direction",
				"ip-number", "ip-range-number",
			],
		},
		get_wifi_rogue_aps: {
			allowlist: [
				"ssid", "mac", "manufacturer", "security_mode", "signal_strength",
				"channel", "is_fake", "is_dead", "wtp_count", "wtp_ip", "last_seen",
			],
		},
		get_ipsec_tunnels: {
			// Applied to the compact view built when group ipsec_compact is on.
			allowlist: [
				"name", "rgwy", "type", "connection_count",
				"incoming_bytes", "outgoing_bytes", "comments", "status",
				"phase2", "p2name", "src", "dst", "expire",
			],
		},
		get_switch_port_status: {
			allowlist: [
				"interface", "status", "speed", "duplex", "vlan",
				"fortilink_port", "fgt_peer_port_name", "fgt_peer_device_name",
				"poe_status", "poe_capable", "port_power",
				"switch_id", "switch_serial",
			],
		},
	},

	limits: {
		// null = defer to maxResponseBytes in fortigate.json (single source of truth)
		maxResponseBytes: null,
		maxArrayItems: 20,
		maxExpandRequests: 40,
	},

	audit: {
		annotate: true,
		// verbose=true is a documented per-tool escape hatch ("full records"), so it
		// must also lift the allowlist — otherwise verbose silently returns the same
		// projected fields. Set false to keep filtering even on verbose calls.
		verboseBypassesFilters: true,
	},
};
