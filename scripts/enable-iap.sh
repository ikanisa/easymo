#!/usr/bin/env bash
#
# enable-iap.sh
# Helper script to enable and configure Identity-Aware Proxy (IAP) for EasyMO admin PWA
#
# Usage:
#   ./scripts/enable-iap.sh --enable-apis
#   ./scripts/enable-iap.sh --project-id=my-project --backend-service=my-backend --member=user:admin@example.com
#   ./scripts/enable-iap.sh --list-services
#   ./scripts/enable-iap.sh --show-policy --backend-service=my-backend
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-europe-west1}"
BACKEND_SERVICE="${BACKEND_SERVICE:-}"
MEMBER="${MEMBER:-}"
ROLE="roles/iap.httpsResourceAccessor"

# Functions
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Options:
  --enable-apis                  Enable required GCP APIs (IAP, Resource Manager, Compute)
  --project-id=PROJECT_ID        GCP project ID (can also use GCP_PROJECT_ID env var)
  --region=REGION                GCP region (default: europe-west1)
  --backend-service=SERVICE      Backend service name for IAP
  --member=MEMBER                Member to grant access (format: user:email@domain.com, group:group@domain.com, or domain:domain.com)
  --role=ROLE                    IAM role to grant (default: roles/iap.httpsResourceAccessor)
  --remove                       Remove access instead of adding
  --list-services                List available backend services
  --show-policy                  Show current IAP policy for a backend service
  --help                         Show this help message

Examples:
  # Enable required APIs
  $0 --enable-apis

  # List available backend services
  $0 --list-services --project-id=my-project

  # Grant access to a user
  $0 --project-id=my-project \\
     --backend-service=my-backend \\
     --member=user:admin@example.com

  # Grant access to a Google Group
  $0 --project-id=my-project \\
     --backend-service=my-backend \\
     --member=group:easymo-admins@example.com

  # Grant access to an entire domain
  $0 --project-id=my-project \\
     --backend-service=my-backend \\
     --member=domain:example.com

  # Remove access from a user
  $0 --project-id=my-project \\
     --backend-service=my-backend \\
     --member=user:oldadmin@example.com \\
     --remove

  # Show current IAP policy
  $0 --show-policy \\
     --backend-service=my-backend

Environment Variables:
  GCP_PROJECT_ID    GCP project ID (alternative to --project-id)
  GCP_REGION        GCP region (alternative to --region)
  BACKEND_SERVICE   Backend service name (alternative to --backend-service)
  MEMBER            Member to grant/revoke access (alternative to --member)

EOF
}

enable_apis() {
    print_info "Enabling required GCP APIs..."
    
    if [ -z "$PROJECT_ID" ]; then
        print_error "Project ID is required. Set GCP_PROJECT_ID or use --project-id"
        exit 1
    fi
    
    gcloud config set project "$PROJECT_ID"
    
    # Enable IAP API
    print_info "Enabling IAP API..."
    gcloud services enable iap.googleapis.com
    print_success "IAP API enabled"
    
    # Enable Cloud Resource Manager API
    print_info "Enabling Cloud Resource Manager API..."
    gcloud services enable cloudresourcemanager.googleapis.com
    print_success "Cloud Resource Manager API enabled"
    
    # Enable Compute Engine API
    print_info "Enabling Compute Engine API..."
    gcloud services enable compute.googleapis.com
    print_success "Compute Engine API enabled"
    
    print_success "All required APIs enabled successfully"
}

list_backend_services() {
    print_info "Listing backend services..."
    
    if [ -z "$PROJECT_ID" ]; then
        print_error "Project ID is required. Set GCP_PROJECT_ID or use --project-id"
        exit 1
    fi
    
    gcloud config set project "$PROJECT_ID"
    
    echo ""
    print_info "Backend Services in project: $PROJECT_ID"
    echo ""
    
    gcloud compute backend-services list --format="table(
        name,
        backends[].group.basename():label=BACKENDS,
        protocol,
        loadBalancingScheme
    )"
}

show_iap_policy() {
    if [ -z "$BACKEND_SERVICE" ]; then
        print_error "Backend service name is required. Use --backend-service"
        exit 1
    fi
    
    print_info "Showing IAP policy for backend service: $BACKEND_SERVICE"
    echo ""
    
    gcloud iap web get-iam-policy \
        --resource-type=backend-services \
        --service="$BACKEND_SERVICE" \
        --format=yaml || {
            print_warning "Failed to get IAP policy. Make sure IAP is enabled for this service."
            exit 1
        }
}

grant_access() {
    local action="$1"  # "add" or "remove"
    
    if [ -z "$BACKEND_SERVICE" ]; then
        print_error "Backend service name is required. Use --backend-service"
        exit 1
    fi
    
    if [ -z "$MEMBER" ]; then
        print_error "Member is required. Use --member (format: user:email@domain.com)"
        exit 1
    fi
    
    # Validate member format
    if [[ ! "$MEMBER" =~ ^(user|group|domain|serviceAccount): ]]; then
        print_error "Invalid member format. Must start with user:, group:, domain:, or serviceAccount:"
        print_info "Examples:"
        print_info "  user:admin@example.com"
        print_info "  group:admins@example.com"
        print_info "  domain:example.com"
        exit 1
    fi
    
    if [ "$action" = "add" ]; then
        print_info "Granting IAP access to: $MEMBER"
        print_info "Backend service: $BACKEND_SERVICE"
        print_info "Role: $ROLE"
        
        gcloud iap web add-iam-policy-binding \
            --resource-type=backend-services \
            --service="$BACKEND_SERVICE" \
            --member="$MEMBER" \
            --role="$ROLE"
        
        print_success "Access granted successfully"
    else
        print_info "Revoking IAP access from: $MEMBER"
        print_info "Backend service: $BACKEND_SERVICE"
        
        gcloud iap web remove-iam-policy-binding \
            --resource-type=backend-services \
            --service="$BACKEND_SERVICE" \
            --member="$MEMBER" \
            --role="$ROLE"
        
        print_success "Access revoked successfully"
    fi
    
    echo ""
    print_info "Current IAP policy:"
    show_iap_policy
}

# Parse arguments
ENABLE_APIS=false
LIST_SERVICES=false
SHOW_POLICY=false
REMOVE_ACCESS=false
GRANT_ACCESS_FLAG=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --enable-apis)
            ENABLE_APIS=true
            shift
            ;;
        --list-services)
            LIST_SERVICES=true
            shift
            ;;
        --show-policy)
            SHOW_POLICY=true
            shift
            ;;
        --remove)
            REMOVE_ACCESS=true
            GRANT_ACCESS_FLAG=true
            shift
            ;;
        --project-id=*)
            PROJECT_ID="${1#*=}"
            shift
            ;;
        --region=*)
            REGION="${1#*=}"
            shift
            ;;
        --backend-service=*)
            BACKEND_SERVICE="${1#*=}"
            shift
            ;;
        --member=*)
            MEMBER="${1#*=}"
            GRANT_ACCESS_FLAG=true
            shift
            ;;
        --role=*)
            ROLE="${1#*=}"
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Execute requested actions
if [ "$ENABLE_APIS" = true ]; then
    enable_apis
    exit 0
fi

if [ "$LIST_SERVICES" = true ]; then
    list_backend_services
    exit 0
fi

if [ "$SHOW_POLICY" = true ]; then
    show_iap_policy
    exit 0
fi

if [ "$GRANT_ACCESS_FLAG" = true ]; then
    if [ "$REMOVE_ACCESS" = true ]; then
        grant_access "remove"
    else
        grant_access "add"
    fi
    exit 0
fi

# No action specified
print_warning "No action specified"
show_usage
exit 1
