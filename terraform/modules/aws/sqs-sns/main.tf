locals {
  common_tags = merge(
    { Environment = var.environment, ManagedBy = "terraform", Module = "sqs-sns" },
    var.tags
  )
  fifo_suffix = var.fifo_queue ? ".fifo" : ""
  queue_name  = "${var.queue_name}-${var.environment}${local.fifo_suffix}"
  dlq_name    = "${var.queue_name}-dlq-${var.environment}${local.fifo_suffix}"
  topic_name  = "${var.topic_name}-${var.environment}${local.fifo_suffix}"
}

resource "aws_sqs_queue" "dlq" {
  name                       = local.dlq_name
  fifo_queue                 = var.fifo_queue
  message_retention_seconds  = 604800
  kms_master_key_id          = var.kms_master_key_id != "" ? var.kms_master_key_id : null
  tags                       = local.common_tags
}

resource "aws_sqs_queue" "this" {
  name                       = local.queue_name
  fifo_queue                 = var.fifo_queue
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  kms_master_key_id          = var.kms_master_key_id != "" ? var.kms_master_key_id : null

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = local.common_tags
}

resource "aws_sns_topic" "this" {
  name             = local.topic_name
  fifo_topic       = var.fifo_queue
  kms_master_key_id = var.kms_master_key_id != "" ? var.kms_master_key_id : null
  tags             = local.common_tags
}

resource "aws_sns_topic_subscription" "sqs" {
  topic_arn = aws_sns_topic.this.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.this.arn

  raw_message_delivery = true
}

resource "aws_sqs_queue_policy" "this" {
  queue_url = aws_sqs_queue.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "sns.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.this.arn
      Condition = {
        ArnEquals = { "aws:SourceArn" = aws_sns_topic.this.arn }
      }
    }]
  })
}
