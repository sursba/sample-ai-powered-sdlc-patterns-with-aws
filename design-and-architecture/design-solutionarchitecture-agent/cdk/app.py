#!/usr/bin/env python3
import os

import aws_cdk as cdk
import cdk_nag

from stack.stack import AWSAgentStack

app = cdk.App()
AWSAgentStack(app, "AWSAgentStack",
    env=cdk.Environment(account=os.getenv('CDK_DEFAULT_ACCOUNT'), region=os.getenv('CDK_DEFAULT_REGION')),
)

cdk.Aspects.of(app).add(cdk_nag.AwsSolutionsChecks(verbose=True))

app.synth()
