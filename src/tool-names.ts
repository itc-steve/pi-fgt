/** All FortiGate tool names registered by this extension. */

import { SYSTEM_HEALTH_TOOL_NAMES } from "./tools/system_health.js";
import { SYSTEM_FABRIC_TOOL_NAMES } from "./tools/system_fabric.js";
import { ROUTER_TOOL_NAMES } from "./tools/router.js";
import { SDWAN_VPN_TOOL_NAMES } from "./tools/sdwan_vpn.js";
import { FIREWALL_MONITOR_TOOL_NAMES } from "./tools/firewall_monitor.js";
import { USER_TOOL_NAMES } from "./tools/users.js";
import { WIFI_TOOL_NAMES } from "./tools/wifi.js";
import { SWITCH_MONITOR_TOOL_NAMES } from "./tools/switch_monitor.js";
import { UTM_ENDPOINT_TOOL_NAMES } from "./tools/utm_endpoint.js";
import { MISC_TOOL_NAMES } from "./tools/misc.js";

const BASE_TOOL_NAMES = [
	// system (10)
	"get_system_status",
	"get_system_resource_usage",
	"get_system_performance",
	"get_system_time",
	"get_firmware_status",
	"get_system_sensors",
	"get_ha_status",
	"get_ha_peers",
	"get_interfaces_status",
	"get_available_licenses",
	// network (5)
	"get_routing_table",
	"get_arp_table",
	"get_dhcp_leases",
	"get_firewall_sessions",
	"get_policy_hit_counts",
	// firewall (11)
	"get_firewall_policies",
	"get_firewall_policy",
	"get_address_objects",
	"get_address_groups",
	"get_service_objects",
	"get_service_groups",
	"get_vip_objects",
	"get_ippools",
	"get_static_routes",
	"get_interfaces_config",
	"get_zones",
	// vpn (4)
	"get_ipsec_phase1",
	"get_ipsec_phase2",
	"get_ipsec_tunnels",
	"get_ssl_vpn_sessions",
	// wireless (2)
	"get_fortiaps",
	"get_wifi_clients",
	// switch / FortiLink (2)
	"get_fortiswitches",
	"get_switch_port_status",
	// security / admin / logs / escape (8)
	"get_security_profiles",
	"get_admin_accounts",
	"get_admin_profiles",
	"list_fortigate_devices",
	"get_logs",
	"get_config_object",
	"get_monitor_resource",
	"attempt_write_operation",
] as const;

export const FORTIGATE_TOOL_NAMES: readonly string[] = [
	...BASE_TOOL_NAMES,
	...SYSTEM_HEALTH_TOOL_NAMES,
	...SYSTEM_FABRIC_TOOL_NAMES,
	...ROUTER_TOOL_NAMES,
	...SDWAN_VPN_TOOL_NAMES,
	...FIREWALL_MONITOR_TOOL_NAMES,
	...USER_TOOL_NAMES,
	...WIFI_TOOL_NAMES,
	...SWITCH_MONITOR_TOOL_NAMES,
	...UTM_ENDPOINT_TOOL_NAMES,
	...MISC_TOOL_NAMES,
];

export type FortiGateToolName = string;

export const FORTIGATE_TOOL_NAME_SET = new Set<string>(FORTIGATE_TOOL_NAMES);
