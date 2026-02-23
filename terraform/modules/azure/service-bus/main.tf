locals {
  common_tags = merge(
    { Environment = var.environment, ManagedBy = "terraform", Module = "service-bus" },
    var.tags
  )
}

resource "azurerm_servicebus_namespace" "this" {
  name                = "${var.namespace_name}-${var.environment}"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = var.sku
  minimum_tls_version = "1.2"

  identity {
    type = "SystemAssigned"
  }

  tags = local.common_tags
}

resource "azurerm_servicebus_queue" "this" {
  for_each     = toset(var.queues)
  name         = each.value
  namespace_id = azurerm_servicebus_namespace.this.id

  max_size_in_megabytes               = var.max_size_in_megabytes
  default_message_ttl                 = var.default_message_ttl
  lock_duration                       = var.lock_duration
  dead_lettering_on_message_expiration = true
  max_delivery_count                  = 10
}

resource "azurerm_servicebus_topic" "this" {
  for_each     = toset(var.topics)
  name         = each.value
  namespace_id = azurerm_servicebus_namespace.this.id

  max_size_in_megabytes = var.max_size_in_megabytes
  default_message_ttl   = var.default_message_ttl
}

resource "azurerm_servicebus_topic_subscription" "dlq" {
  for_each           = toset(var.topics)
  name               = "${each.value}-dlq"
  topic_id           = azurerm_servicebus_topic.this[each.key].id
  max_delivery_count = 1
  dead_lettering_on_message_expiration = true
}
