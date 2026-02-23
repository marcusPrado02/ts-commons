terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    # Configure via environment variables or partial config:
    # terraform init -backend-config="bucket=my-tf-state" \
    #   -backend-config="key=ts-commons/dev/terraform.tfstate" \
    #   -backend-config="region=us-east-1"
    bucket         = "ts-commons-tfstate-dev"
    key            = "ts-commons/dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "ts-commons-tfstate-lock"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "ts-commons"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

provider "azurerm" {
  features {}
  skip_provider_registration = true
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}
