# Terraform Modules

Cloud-provider–agnostic Terraform modules for deploying `ts-commons` workloads.

## Structure

```
terraform/
├── modules/
│   ├── aws/
│   │   ├── ecs-fargate/    # ECS Fargate cluster + service + IAM
│   │   ├── rds/            # RDS instance + subnet group + security group
│   │   ├── elasticache/    # ElastiCache Redis replication group
│   │   ├── sqs-sns/        # SQS queue + DLQ + SNS topic + subscription
│   │   └── cloudwatch/     # Log group + metric alarms + dashboard
│   ├── azure/
│   │   ├── app-service/    # App Service Plan + Linux Web App
│   │   ├── container-apps/ # Container Apps Environment + Container App
│   │   ├── sql/            # SQL Server + Database
│   │   ├── service-bus/    # Service Bus Namespace + Queues + Topics
│   │   └── app-insights/   # Application Insights + Log Analytics Workspace
│   └── gcp/
│       ├── cloud-run/      # Cloud Run v2 Service + IAM
│       ├── cloud-sql/      # Cloud SQL instance + Database + User
│       ├── memorystore/    # Memorystore Redis instance
│       ├── pubsub/         # Pub/Sub Topics + Subscriptions + DLQs
│       └── monitoring/     # Alerting policies + Uptime checks
└── environments/
    ├── dev/
    ├── staging/
    └── production/
```

## Usage

### Initialize an environment

```bash
cd terraform/environments/dev
terraform init
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"
```

### Use a module directly

```hcl
module "ecs" {
  source             = "../../modules/aws/ecs-fargate"
  cluster_name       = "my-cluster"
  service_name       = "my-service"
  image              = "123.dkr.ecr.us-east-1.amazonaws.com/my-app:latest"
  subnet_ids         = ["subnet-abc", "subnet-def"]
  security_group_ids = ["sg-xyz"]
  environment        = "staging"
}
```

## Requirements

- Terraform >= 1.7.0
- AWS provider ~> 5.0
- AzureRM provider ~> 3.90
- Google provider ~> 5.0
