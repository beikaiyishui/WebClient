angular.module('proton.controllers.Settings')

.controller('DomainsController', (
    $q,
    $rootScope,
    $scope,
    gettextCatalog,
    Address,
    addressModal,
    authentication,
    confirmModal,
    CONSTANTS,
    dkimModal,
    dmarcModal,
    Domain,
    domainModal,
    domains,
    eventManager,
    generateModal,
    Member,
    members,
    mxModal,
    networkActivityTracker,
    notify,
    Organization,
    organizationKeys,
    spfModal,
    verificationModal
) => {
    // Variables
    $scope.organizationPublicKey = organizationKeys.data.PublicKey;
    $scope.domains = domains.data.Domains;
    $scope.members = members.data.Members;

    // Listeners
    $scope.$on('domain', (event, domain) => {
        $scope.closeModals();
        $scope.addDomain(domain);
    });

    $scope.$on('spf', (event, domain) => {
        $scope.closeModals();
        $scope.spf(domain);
    });

    $scope.$on('address', (event, domain) => {
        $scope.closeModals();
        $scope.addAddress(domain);
    });

    $scope.$on('mx', (event, domain) => {
        $scope.closeModals();
        $scope.mx(domain);
    });

    $scope.$on('dkim', (event, domain) => {
        $scope.closeModals();
        $scope.dkim(domain);
    });

    $scope.$on('verification', (event, domain) => {
        $scope.closeModals();
        $scope.verification(domain);
    });

    $scope.$on('dmarc', (event, domain) => {
        $scope.closeModals();
        $scope.dmarc(domain);
    });

    $scope.$on('deleteDomain', (event, domainId) => {
        const index = _.findIndex($scope.domains, { ID: domainId });

        if (index !== -1) {
            $scope.domains.splice(index, 1);
        }
    });

    $scope.$on('createDomain', (event, domainId, domain) => {
        const index = _.findIndex($scope.domains, { ID: domainId });

        if (index === -1) {
            $scope.domains.push(domain);
        } else {
            _.extend($scope.domains[index], domain);
        }
    });

    $scope.$on('updateDomain', (event, domainId, domain) => {
        const index = _.findIndex($scope.domains, { ID: domainId });

        if (index === -1) {
            $scope.domains.push(domain);
        } else {
            _.extend($scope.domains[index], domain);
        }
    });

    $rootScope.$on('deleteMember', (event, memberId) => {
        const index = _.findIndex($scope.members, { ID: memberId });

        if (index !== -1) {
            $scope.members.splice(index, 1);
        }
    });

    $rootScope.$on('createMember', (event, memberId, member) => {
        const index = _.findIndex($scope.members, { ID: memberId });

        if (index === -1) {
            $scope.members.push(member);
        } else {
            _.extend($scope.members[index], member);
        }
    });

    $rootScope.$on('updateMember', (event, memberId, member) => {
        const index = _.findIndex($scope.members, { ID: memberId });

        if (index === -1) {
            $scope.members.push(member);
        } else {
            _.extend($scope.members[index], member);
        }
    });

    /**
     * Open modal process to add a custom domain.
     * @param {Object} domain
     * Docs: https://github.com/ProtonMail/Slim-API/blob/develop_domain/api-spec/pm_api_domains.md
     */
    $scope.wizard = function (domain) {
        // go through all steps and show the user the step they need to complete next. allow for back and next options.
        // if domain has a name, we can skip the first step
        /* steps:
            1. verify ownership with txt record
            2. add addresses
            3. add mx
            4. add spf
            5. add dkim
            6. add dmarc
        */
        if (!domain.DomainName) {
            // show first step
            $scope.addDomain();
        } else if ((domain.VerifyState !== 2)) {
            $scope.verification(domain);
        } else if (domain.Addresses.length === 0) {
            $scope.addAddress(domain);
        } else if (domain.MxState !== 3) {
            $scope.mx(domain);
        } else if (domain.SpfState !== 3) {
            $scope.spf(domain);
        } else if (domain.DkimState !== 4) {
            $scope.dkim(domain);
        } else if (domain.DmarcState !== 3) {
            $scope.dmarc(domain);
        }
    };

    /**
     * Delete domain
     * @param {Object} domain
     */
    $scope.deleteDomain = function (domain) {
        const index = $scope.domains.indexOf(domain);

        confirmModal.activate({
            params: {
                title: gettextCatalog.getString('Delete domain', null, 'Title'),
                message: gettextCatalog.getString('Are you sure you want to delete this address?', null, 'Info'),
                confirm() {
                    networkActivityTracker.track(Domain.delete(domain.ID).then((result) => {
                        if (angular.isDefined(result.data) && result.data.Code === 1000) {
                            notify({ message: gettextCatalog.getString('Domain deleted', null), classes: 'notification-success' });
                            $scope.domains.splice(index, 1); // Remove domain in interface
                            eventManager.call(); // Call event log manager
                            confirmModal.deactivate();
                        } else if (angular.isDefined(result.data) && result.data.Error) {
                            notify({ message: result.data.Error, classes: 'notification-danger' });
                        } else {
                            notify({ message: gettextCatalog.getString('Error during deletion', null, 'Error'), classes: 'notification-danger' });
                        }
                    }, () => {
                        notify({ message: gettextCatalog.getString('Error during deletion', null, 'Error'), classes: 'notification-danger' });
                    }));
                },
                cancel() {
                    confirmModal.deactivate();
                }
            }
        });
    };

    /**
     * Check if this address is owned by the current user
     * @param {Object} address
     * @return {Boolean}
     */
    $scope.owned = function (address) {
        const found = _.findWhere(authentication.user.Addresses, { ID: address.ID });

        return angular.isDefined(found);
    };

    /**
     * Check if this address is owned by a private member
     * @param {Object} address
     * @return {Boolean}
     */
    $scope.privated = function (address) {
        const member = _.findWhere($scope.members, { ID: address.MemberID });

        return member.Private === 1;
    };

    /**
     * Open modal to generate key pair
     */
    $scope.generate = function (address) {
        generateModal.activate({
            params: {
                title: gettextCatalog.getString('Generate key pair', null),
                message: '', // TODO need text
                addresses: [address],
                password: authentication.getPassword(),
                close(success) {
                    if (success) {
                        eventManager.call();
                    }

                    generateModal.deactivate();
                }
            }
        });
    };

    /**
     * Delete address
     * @param {Object} address
     * @param {Object} domain
     */
    $scope.deleteAddress = function (address, domain) {
        const index = domain.Addresses.indexOf(address);

        confirmModal.activate({
            params: {
                title: gettextCatalog.getString('Delete address', null, 'Title'),
                message: gettextCatalog.getString('Are you sure you want to delete this address?', null, 'Info'),
                confirm() {
                    networkActivityTracker.track(Address.delete(address.ID).then((result) => {
                        if (angular.isDefined(result.data) && result.data.Code === 1000) {
                            notify({ message: gettextCatalog.getString('Address deleted', null, 'Info'), classes: 'notification-success' });
                            domain.Addresses.splice(index, 1); // Remove address in interface
                            eventManager.call(); // Call event log manager
                            confirmModal.deactivate();
                        } else if (angular.isDefined(result.data) && result.data.Error) {
                            notify({ message: result.data.Error, classes: 'notification-danger' });
                        } else {
                            notify({ message: gettextCatalog.getString('Error during deletion', null, 'Error'), classes: 'notification-danger' });
                        }
                    }, () => {
                        notify({ message: gettextCatalog.getString('Error during deletion', null, 'Error'), classes: 'notification-danger' });
                    }));
                },
                cancel() {
                    confirmModal.deactivate();
                }
            }
        });
    };

    /**
     * Enable an address
     */
    $scope.enableAddress = function (address) {
        networkActivityTracker.track(Address.enable(address.ID).then((result) => {
            if (angular.isDefined(result.data) && result.data.Code === 1000) {
                notify({ message: gettextCatalog.getString('Address enabled', null, 'Info'), classes: 'notification-success' });
                address.Status = 1;
            } else if (angular.isDefined(result.data) && result.data.Error) {
                notify({ message: result.data.Error, classes: 'notification-danger' });
            } else {
                notify({ message: gettextCatalog.getString('Error during enable request', null, 'Error'), classes: 'notification-danger' });
            }
        }, () => {
            notify({ message: gettextCatalog.getString('Error during enable request', null, 'Error'), classes: 'notification-danger' });
        }));
    };

    /**
     * Open a modal to disable an address
     */
    $scope.disableAddress = function (address) {
        confirmModal.activate({
            params: {
                title: gettextCatalog.getString('Disable address', null, 'Title'),
                message: gettextCatalog.getString('Are you sure you want to disable this address?', null, 'Info'),
                confirm() {
                    networkActivityTracker.track(Address.disable(address.ID).then((result) => {
                        if (angular.isDefined(result.data) && result.data.Code === 1000) {
                            notify({ message: gettextCatalog.getString('Address disabled', null, 'Info'), classes: 'notification-success' });
                            address.Status = 0;
                            confirmModal.deactivate();
                        } else if (angular.isDefined(result.data) && result.data.Error) {
                            notify({ message: result.data.Error, classes: 'notification-danger' });
                        } else {
                            notify({ message: gettextCatalog.getString('Error during disable request', null, 'Error'), classes: 'notification-danger' });
                        }
                    }, () => {
                        notify({ message: gettextCatalog.getString('Error during disable request', null, 'Error'), classes: 'notification-danger' });
                    }));
                },
                cancel() {
                    confirmModal.deactivate();
                }
            }
        });
    };

    /**
     * Open modal process to add a custom domain
     */
    $scope.addDomain = function (domain) {
        domainModal.activate({
            params: {
                step: 1,
                domain,
                submit(name) {
                    networkActivityTracker.track(Domain.create({ Name: name }).then((result) => {
                        if (angular.isDefined(result.data) && result.data.Code === 1000) {
                            notify({ message: gettextCatalog.getString('Domain created', null), classes: 'notification-success' });
                            $scope.domains.push(result.data.Domain);
                            eventManager.call(); // Call event log manager
                            domainModal.deactivate();
                            // open the next step
                            $scope.verification(result.data.Domain);
                        } else if (angular.isDefined(result.data) && result.data.Error) {
                            notify({ message: result.data.Error, classes: 'notification-danger' });
                        } else {
                            notify({ message: gettextCatalog.getString('Error during creation', null, 'Error'), classes: 'notification-danger' });
                        }
                    }, () => {
                        notify({ message: gettextCatalog.getString('Error during creation', null, 'Error'), classes: 'notification-danger' });
                    }));
                },
                next() {
                    domainModal.deactivate();
                    $scope.verification(domain);
                },
                cancel() {
                    domainModal.deactivate();
                }
            }
        });
    };

    /**
     * Refresh status for a domain
     * @param {Object} domain
     */
    $scope.refreshStatus = function () {
        networkActivityTracker.track(Domain.query().then((result) => {
            if (result.data && result.data.Code === 1000) {
                $scope.domains = result.data.Domains;
            }
        }));
    };

    /**
     * Open verification modal
     * @param {Object} domain
     */
    $scope.verification = function (domain) {
        const index = $scope.domains.indexOf(domain);

        verificationModal.activate({
            params: {
                domain,
                step: 2,
                submit() {
                    networkActivityTracker.track(Domain.get(domain.ID).then((result) => {
                        if (angular.isDefined(result.data) && result.data.Code === 1000) {
                            // check verification code
                            // 0 is default, 1 is has code but wrong, 2 is good
                            switch (result.data.Domain.VerifyState) {
                                case 0:
                                    notify({ message: gettextCatalog.getString('Verification did not succeed, please try again in an hour.', null, 'Error'), classes: 'notification-danger' });
                                    break;
                                case 1:
                                    notify({ message: gettextCatalog.getString('Wrong verification code. Please make sure you copied the verification code correctly and try again. It can take up to 1 hour for changes to take affect.', null, 'Error'), classes: 'notification-danger', duration: 30000 });
                                    break;
                                case 2:
                                    notify({ message: gettextCatalog.getString('Domain verified', null), classes: 'notification-success' });
                                    $scope.domains[index] = result.data.Domain;
                                    verificationModal.deactivate();
                                    // open the next step
                                    $scope.addAddress(result.data.Domain);
                                    break;
                                default:
                                    break;
                            }
                        } else if (angular.isDefined(result.data) && result.data.Error) {
                            notify({ message: result.data.Error, classes: 'notification-danger' });
                        } else {
                            notify({ message: gettextCatalog.getString('Verification did not succeed, please try again in an hour.', null, 'Error'), classes: 'notification-danger' });
                        }
                    }, () => {
                        notify({ message: gettextCatalog.getString('Verification did not succeed, please try again in an hour.', null, 'Error'), classes: 'notification-danger' });
                    }));
                },
                next() {
                    $scope.addAddress(domain);
                },
                close() {
                    verificationModal.deactivate();
                }
            }
        });
    };

    /**
     * Open modal to add a new address
     */
    $scope.addAddress = function (domain) {
        addressModal.activate({
            params: {
                step: 3,
                domain,
                members: $scope.members,
                organizationPublicKey: $scope.organizationPublicKey,
                next() {
                    addressModal.deactivate();
                    $scope.mx(domain);
                },
                cancel() {
                    addressModal.deactivate();
                    eventManager.call();
                }
            }
        });
    };

    /**
     * Open MX modal
     * @param {Object} domain
     */
    $scope.mx = function (domain) {
        mxModal.activate({
            params: {
                domain,
                step: 4,
                next() {
                    mxModal.deactivate();
                    $scope.spf(domain);

                },
                close() {
                    mxModal.deactivate();
                    eventManager.call();
                }
            }
        });
    };

    /**
     * Open SPF modal
     * @param {Object} domain
     */
    $scope.spf = function (domain) {
        spfModal.activate({
            params: {
                domain,
                step: 5,
                next() {
                    spfModal.deactivate();
                    $scope.dkim(domain);
                },
                close() {
                    spfModal.deactivate();
                    eventManager.call();
                }
            }
        });
    };

    /**
     * Open DKIM modal
     * @param {Object} domain
     */
    $scope.dkim = function (domain) {
        dkimModal.activate({
            params: {
                domain,
                step: 6,
                next() {
                    dkimModal.deactivate();
                    $scope.dmarc(domain);
                },
                close() {
                    dkimModal.deactivate();
                    eventManager.call();
                }
            }
        });
    };

    /**
     * Open DMARC modal
     * @param {Object} domain
     */
    $scope.dmarc = function (domain) {
        const index = $scope.domains.indexOf(domain);

        dmarcModal.activate({
            params: {
                domain,
                step: 7,
                verify() {
                    networkActivityTracker.track(Domain.get(domain.ID).then((result) => {
                        if (angular.isDefined(result.data) && result.data.Code === 1000) {
                            $scope.domains[index] = result.data.Domain;
                            dmarcModal.deactivate();
                            eventManager.call();
                        } else if (angular.isDefined(result.data) && result.data.Error) {
                            notify({ message: result.data.Error, classes: 'notification-danger' });
                        } else {
                            notify({ message: gettextCatalog.getString('Verification did not succeed, please try again in an hour.', null, 'Error'), classes: 'notification-danger' });
                        }
                    }, () => {
                        notify({ message: gettextCatalog.getString('Verification did not succeed, please try again in an hour.', null, 'Error'), classes: 'notification-danger' });
                    }));
                },
                close() {
                    dmarcModal.deactivate();
                    eventManager.call();
                }
            }
        });
    };

    /**
     * Close all verification modals
     */
    $scope.closeModals = function () {
        domainModal.deactivate();
        verificationModal.deactivate();
        dkimModal.deactivate();
        dmarcModal.deactivate();
        spfModal.deactivate();
        mxModal.deactivate();
        addressModal.deactivate();
    };

    /**
     * Return member Object for a specific memberId
     * @param {String} memberId
     * @return {Object} member
     */
    $scope.member = function (memberId) {
        const member = _.findWhere($scope.members, { ID: memberId });

        if (angular.isDefined(member)) {
            return member;
        }
    };
});
