// Manual material calculation engine - completely independent of drawing
export function calculateMaterialsManually(inputs) {
    const materials = [];
    const {
        materialType,
        fenceHeight,
        style,
        linearFootage,
        // Vinyl
        vinylPanels,
        galvanizedLinePosts,
        noDigDonuts,
        terminalPosts,
        cornerPosts,
        iBeamGatePosts,
        postCaps,
        // Chain Link
        wireRolls,
        chainLinkLinePosts,
        chainLinkTerminalPosts,
        chainLinkCornerPosts,
        tensionBars,
        tensionBands,
        braceBands,
        railEndCups,
        carriageBolts,
        topRail,
        loopCaps,
        tensionWire,
        chainLinkPostCaps,
        chainLinkLatches,
        chainLinkTies,
        // Wood
        postmasterSteelPosts,
        treatedRails,
        pickets,
        deckBoards8ft,
        deckScrews,
        coilNails,
        postBrackets,
        // Aluminum
        aluminumSections,
        aluminumLinePosts,
        aluminumEndPosts,
        aluminumCornerPosts,
        aluminumPostCaps,
        // Gates
        singleGateCount,
        singleGate4ft,
        singleGate5ft,
        singleGate6ft,
        doubleGateCount,
        doubleGate8ft,
        doubleGate10ft,
        doubleGate12ft,
        // Universal
        concreteBags
    } = inputs;

    if (linearFootage === 0) {
        return materials;
    }

    // Calculate panel spacing (typical 8' panels for most fence types)
    const panelWidth = 8;
    const panels = Math.ceil(linearFootage / panelWidth);

    if (materialType === 'Vinyl') {
        // VINYL NO-DIG SYSTEM
        const totalGates = singleGateCount + doubleGateCount;
        
        // Panels
        const panelsCalc = vinylPanels > 0 ? vinylPanels : panels;
        materials.push({
            lineItemName: `${fenceHeight} ${style} Vinyl Panels`,
            quantity: panelsCalc,
            unit: 'pcs',
            calculationDetails: vinylPanels > 0 ? 'Manual override' : `${linearFootage} LF ÷ ${panelWidth} ft`
        });
        
        // Line posts (galvanized 2.5")
        const linePostsCalc = galvanizedLinePosts > 0 ? galvanizedLinePosts : (panels - 1);
        materials.push({
            lineItemName: '2.5" Galvanized Line Posts',
            quantity: linePostsCalc,
            unit: 'pcs',
            calculationDetails: galvanizedLinePosts > 0 ? 'Manual override' : `${linePostsCalc} posts for ${panels} panels`
        });

        // Donuts (2 per galvanized post)
        const donutsCalc = noDigDonuts > 0 ? noDigDonuts : (linePostsCalc * 2);
        materials.push({
            lineItemName: 'No-Dig Donuts',
            quantity: donutsCalc,
            unit: 'pcs',
            calculationDetails: noDigDonuts > 0 ? 'Manual override' : `2 per line post × ${linePostsCalc} posts`
        });

        // Terminal posts
        const terminalsCalc = terminalPosts > 0 ? terminalPosts : 2;
        materials.push({
            lineItemName: 'Terminal Posts (Set in Concrete)',
            quantity: terminalsCalc,
            unit: 'pcs',
            calculationDetails: terminalPosts > 0 ? 'Manual override' : 'End posts'
        });

        // Corner posts
        if (cornerPosts > 0) {
            materials.push({
                lineItemName: 'Corner Posts (Set in Concrete)',
                quantity: cornerPosts,
                unit: 'pcs',
                calculationDetails: 'Corner posts'
            });
        }

        // I-Beam posts for gates
        const gatePostsCalc = iBeamGatePosts > 0 ? iBeamGatePosts : (totalGates * 2);
        if (totalGates > 0) {
            materials.push({
                lineItemName: 'I-Beam Gate Posts',
                quantity: gatePostsCalc,
                unit: 'pcs',
                calculationDetails: iBeamGatePosts > 0 ? 'Manual override' : `2 per gate × ${totalGates} gates`
            });
        }

        // Post caps
        const totalPostsCalc = linePostsCalc + terminalsCalc + cornerPosts + gatePostsCalc;
        const capsCalc = postCaps > 0 ? postCaps : totalPostsCalc;
        materials.push({
            lineItemName: 'Post Caps',
            quantity: capsCalc,
            unit: 'pcs',
            calculationDetails: postCaps > 0 ? 'Manual override' : `1 per post × ${totalPostsCalc} posts`
        });

        // Gate assemblies
        if (singleGate4ft > 0) {
            materials.push({
                lineItemName: `${fenceHeight} 4' Single Gate Assembly`,
                quantity: singleGate4ft,
                unit: 'pcs',
                calculationDetails: 'Includes frame, pickets, hinges, latch'
            });
        }
        if (singleGate5ft > 0) {
            materials.push({
                lineItemName: `${fenceHeight} 5' Single Gate Assembly`,
                quantity: singleGate5ft,
                unit: 'pcs',
                calculationDetails: 'Includes frame, pickets, hinges, latch'
            });
        }
        if (singleGate6ft > 0) {
            materials.push({
                lineItemName: `${fenceHeight} 6' Single Gate Assembly`,
                quantity: singleGate6ft,
                unit: 'pcs',
                calculationDetails: 'Includes frame, pickets, hinges, latch'
            });
        }
        if (doubleGate8ft > 0) {
            materials.push({
                lineItemName: `${fenceHeight} 8' Double Gate Assembly`,
                quantity: doubleGate8ft,
                unit: 'pcs',
                calculationDetails: 'Includes frames, pickets, hinges, latches, drop rod'
            });
        }
        if (doubleGate10ft > 0) {
            materials.push({
                lineItemName: `${fenceHeight} 10' Double Gate Assembly`,
                quantity: doubleGate10ft,
                unit: 'pcs',
                calculationDetails: 'Includes frames, pickets, hinges, latches, drop rod'
            });
        }
        if (doubleGate12ft > 0) {
            materials.push({
                lineItemName: `${fenceHeight} 12' Double Gate Assembly`,
                quantity: doubleGate12ft,
                unit: 'pcs',
                calculationDetails: 'Includes frames, pickets, hinges, latches, drop rod'
            });
        }

    } else if (materialType === 'Chain Link') {
        // CHAIN LINK SYSTEM
        const heightNum = parseInt(fenceHeight);
        let tensionBandsPerTerminal = 3;
        if (heightNum >= 5) tensionBandsPerTerminal = 4;
        if (heightNum >= 6) tensionBandsPerTerminal = 5;
        
        // Wire rolls
        const rollLength = 50;
        const calculatedRolls = Math.ceil(linearFootage / rollLength);
        const finalRolls = wireRolls > 0 ? wireRolls : calculatedRolls;
        materials.push({
            lineItemName: `${fenceHeight} Chain Link Wire Rolls`,
            quantity: finalRolls,
            unit: 'rolls',
            calculationDetails: wireRolls > 0 ? 'Manual override' : `${linearFootage} LF ÷ ${rollLength} ft per roll`
        });

        // Line posts
        const linePostsCalc = chainLinkLinePosts > 0 ? chainLinkLinePosts : Math.ceil(linearFootage / 10);
        materials.push({
            lineItemName: `${fenceHeight} Line Posts`,
            quantity: linePostsCalc,
            unit: 'pcs',
            calculationDetails: chainLinkLinePosts > 0 ? 'Manual override' : `1 post every 10 ft × ${linearFootage} LF`
        });

        // Terminal posts
        const terminalsCalc = chainLinkTerminalPosts > 0 ? chainLinkTerminalPosts : 2;
        materials.push({
            lineItemName: 'Terminal Posts',
            quantity: terminalsCalc,
            unit: 'pcs',
            calculationDetails: chainLinkTerminalPosts > 0 ? 'Manual override' : 'End posts'
        });

        // Tension bars
        const tensionBarsCalc = tensionBars > 0 ? tensionBars : terminalsCalc;
        materials.push({
            lineItemName: 'Tension Bars',
            quantity: tensionBarsCalc,
            unit: 'pcs',
            calculationDetails: tensionBars > 0 ? 'Manual override' : `1 per terminal post × ${terminalsCalc}`
        });

        // Tension bands
        const tensionBandsCalc = tensionBands > 0 ? tensionBands : (terminalsCalc * tensionBandsPerTerminal);
        materials.push({
            lineItemName: 'Tension Bands',
            quantity: tensionBandsCalc,
            unit: 'pcs',
            calculationDetails: tensionBands > 0 ? 'Manual override' : `${tensionBandsPerTerminal} per terminal × ${terminalsCalc} posts`
        });

        // Brace bands
        const braceBandsCalc = braceBands > 0 ? braceBands : terminalsCalc;
        materials.push({
            lineItemName: 'Brace Bands',
            quantity: braceBandsCalc,
            unit: 'pcs',
            calculationDetails: braceBands > 0 ? 'Manual override' : `1 per terminal × ${terminalsCalc}`
        });

        // Rail end cups
        const railEndCupsCalc = railEndCups > 0 ? railEndCups : terminalsCalc;
        materials.push({
            lineItemName: 'Rail End Cups',
            quantity: railEndCupsCalc,
            unit: 'pcs',
            calculationDetails: railEndCups > 0 ? 'Manual override' : `1 per terminal × ${terminalsCalc}`
        });

        // Carriage bolts
        const carriageBoltsCalc = carriageBolts > 0 ? carriageBolts : terminalsCalc;
        materials.push({
            lineItemName: 'Carriage Bolts (5-pack)',
            quantity: carriageBoltsCalc,
            unit: 'packs',
            calculationDetails: carriageBolts > 0 ? 'Manual override' : `5 bolts per terminal × ${terminalsCalc}`
        });

        // Corner posts
        const cornersCalc = chainLinkCornerPosts > 0 ? chainLinkCornerPosts : 0;
        if (cornersCalc > 0) {
            materials.push({
                lineItemName: 'Corner Posts',
                quantity: cornersCalc,
                unit: 'pcs',
                calculationDetails: 'Corner posts'
            });

            materials.push({
                lineItemName: 'Tension Bars (Corner)',
                quantity: cornersCalc * 2,
                unit: 'pcs',
                calculationDetails: `2 per corner × ${cornersCalc}`
            });

            materials.push({
                lineItemName: 'Tension Bands (Corner)',
                quantity: cornersCalc * tensionBandsPerTerminal * 2,
                unit: 'pcs',
                calculationDetails: `${tensionBandsPerTerminal * 2} per corner × ${cornersCalc}`
            });
        }

        // Top rail (21 ft sticks)
        const topRailSticks = topRail > 0 ? topRail : Math.ceil(linearFootage / 21);
        materials.push({
            lineItemName: 'Top Rail',
            quantity: topRailSticks,
            unit: 'sticks',
            calculationDetails: topRail > 0 ? 'Manual override' : `${linearFootage} LF ÷ 21 ft per stick = ${topRailSticks} sticks`
        });

        // Loop caps
        const loopCapsCalc = loopCaps > 0 ? loopCaps : linePostsCalc;
        materials.push({
            lineItemName: 'Loop Caps',
            quantity: loopCapsCalc,
            unit: 'pcs',
            calculationDetails: loopCaps > 0 ? 'Manual override' : `1 per line post × ${linePostsCalc}`
        });

        // Tension wire (optional)
        if (tensionWire > 0) {
            materials.push({
                lineItemName: 'Tension Wire',
                quantity: tensionWire,
                unit: 'LF',
                calculationDetails: 'Manual entry'
            });
        }

        // Post caps (optional)
        if (chainLinkPostCaps > 0) {
            materials.push({
                lineItemName: 'Post Caps',
                quantity: chainLinkPostCaps,
                unit: 'pcs',
                calculationDetails: 'Manual entry'
            });
        }

        // Latches (optional)
        if (chainLinkLatches > 0) {
            materials.push({
                lineItemName: 'Gate Latches',
                quantity: chainLinkLatches,
                unit: 'pcs',
                calculationDetails: 'Manual entry'
            });
        }

        // Ties (optional)
        if (chainLinkTies > 0) {
            materials.push({
                lineItemName: 'Ties',
                quantity: chainLinkTies,
                unit: 'packs',
                calculationDetails: 'Manual entry'
            });
        }

        // Gates
        if (singleGateCount > 0) {
            materials.push({
                lineItemName: `${fenceHeight} Chain Link Single Gate`,
                quantity: singleGateCount,
                unit: 'pcs',
                calculationDetails: 'Includes frame, fabric, hinges, latch'
            });
        }
        if (doubleGateCount > 0) {
            materials.push({
                lineItemName: `${fenceHeight} Chain Link Double Gate`,
                quantity: doubleGateCount,
                unit: 'pcs',
                calculationDetails: 'Includes frames, fabric, hinges, latches, fork latch'
            });
        }

    } else if (materialType === 'Wood') {
        // WOOD SYSTEM
        const railsPerSection = parseInt(fenceHeight) >= 6 ? 3 : 2;
        const sections = Math.ceil(linearFootage / 8);
        const picketsPerFoot = 2;

        // Postmaster steel posts (typically 8' spacing)
        const postsCalc = postmasterSteelPosts > 0 ? postmasterSteelPosts : (Math.ceil(linearFootage / 8) + 1);
        materials.push({
            lineItemName: 'Postmaster Steel Posts',
            quantity: postsCalc,
            unit: 'pcs',
            calculationDetails: postmasterSteelPosts > 0 ? 'Manual override' : `1 post every 8 ft × ${linearFootage} LF`
        });

        // Rails
        const railsCalc = treatedRails > 0 ? treatedRails : (sections * railsPerSection);
        materials.push({
            lineItemName: '2×4×8 Treated Rails',
            quantity: railsCalc,
            unit: 'pcs',
            calculationDetails: treatedRails > 0 ? 'Manual override' : `${railsPerSection} rails per section × ${sections} sections`
        });

        // Pickets
        const picketsCalc = pickets > 0 ? pickets : Math.ceil(linearFootage * picketsPerFoot);
        materials.push({
            lineItemName: `${fenceHeight} Pickets`,
            quantity: picketsCalc,
            unit: 'pcs',
            calculationDetails: pickets > 0 ? 'Manual override' : `~${picketsPerFoot} per linear foot × ${linearFootage} LF`
        });

        // 8' Deck boards (optional)
        if (deckBoards8ft > 0) {
            materials.push({
                lineItemName: '8\' Deck Boards',
                quantity: deckBoards8ft,
                unit: 'pcs',
                calculationDetails: 'Manual entry'
            });
        }

        // Deck screws
        const deckScrewsCalc = deckScrews > 0 ? deckScrews : Math.ceil(sections / 4);
        materials.push({
            lineItemName: 'Deck Screws (5 lb box)',
            quantity: deckScrewsCalc,
            unit: 'boxes',
            calculationDetails: deckScrews > 0 ? 'Manual override' : '1 box per ~4 sections'
        });

        // Coil nails (optional)
        if (coilNails > 0) {
            materials.push({
                lineItemName: 'Coil Nails',
                quantity: coilNails,
                unit: 'boxes',
                calculationDetails: 'Manual entry'
            });
        }

        // Post brackets
        const bracketsCalc = postBrackets > 0 ? postBrackets : postsCalc;
        materials.push({
            lineItemName: 'Post Brackets',
            quantity: bracketsCalc,
            unit: 'pcs',
            calculationDetails: postBrackets > 0 ? 'Manual override' : `1 per post × ${postsCalc}`
        });

        // Gates
        if (singleGateCount > 0) {
            materials.push({
                lineItemName: `${fenceHeight} Wood Single Gate`,
                quantity: singleGateCount,
                unit: 'pcs',
                calculationDetails: 'Frame, pickets, hinges, latch'
            });
        }
        if (doubleGateCount > 0) {
            materials.push({
                lineItemName: `${fenceHeight} Wood Double Gate`,
                quantity: doubleGateCount,
                unit: 'pcs',
                calculationDetails: 'Frames, pickets, hinges, latches'
            });
        }

    } else if (materialType === 'Aluminum') {
        // ALUMINUM SYSTEM
        const sectionWidth = 8;
        const sections = Math.ceil(linearFootage / sectionWidth);
        
        // Sections
        const sectionsCalc = aluminumSections > 0 ? aluminumSections : sections;
        materials.push({
            lineItemName: `${fenceHeight} Aluminum Rackable Sections`,
            quantity: sectionsCalc,
            unit: 'pcs',
            calculationDetails: aluminumSections > 0 ? 'Manual override' : `${linearFootage} LF ÷ ${sectionWidth} ft`
        });

        // Line posts
        const linePostsCalc = aluminumLinePosts > 0 ? aluminumLinePosts : (sections - 1);
        materials.push({
            lineItemName: `${fenceHeight} Aluminum Line Posts`,
            quantity: linePostsCalc,
            unit: 'pcs',
            calculationDetails: aluminumLinePosts > 0 ? 'Manual override' : `${linePostsCalc} posts for ${sections} sections`
        });

        // End posts
        const endPostsCalc = aluminumEndPosts > 0 ? aluminumEndPosts : 2;
        materials.push({
            lineItemName: `${fenceHeight} Aluminum End Posts`,
            quantity: endPostsCalc,
            unit: 'pcs',
            calculationDetails: aluminumEndPosts > 0 ? 'Manual override' : 'End posts'
        });

        // Corner posts
        const cornersCalc = aluminumCornerPosts > 0 ? aluminumCornerPosts : 0;
        if (cornersCalc > 0) {
            materials.push({
                lineItemName: `${fenceHeight} Aluminum Corner Posts`,
                quantity: cornersCalc,
                unit: 'pcs',
                calculationDetails: 'Corner posts'
            });
        }

        // Post caps
        const totalPostsCalc = linePostsCalc + endPostsCalc + cornersCalc;
        const capsCalc = aluminumPostCaps > 0 ? aluminumPostCaps : totalPostsCalc;
        materials.push({
            lineItemName: 'Post Caps',
            quantity: capsCalc,
            unit: 'pcs',
            calculationDetails: aluminumPostCaps > 0 ? 'Manual override' : `1 per post × ${totalPostsCalc}`
        });

        // Gates
        if (singleGateCount > 0) {
            materials.push({
                lineItemName: `${fenceHeight} Aluminum Single Gate`,
                quantity: singleGateCount,
                unit: 'pcs',
                calculationDetails: 'Includes frame, pickets, hinges, latch'
            });
        }
        if (doubleGateCount > 0) {
            materials.push({
                lineItemName: `${fenceHeight} Aluminum Double Gate`,
                quantity: doubleGateCount,
                unit: 'pcs',
                calculationDetails: 'Includes frames, pickets, hinges, latches'
            });
        }
    }

    // Concrete (if not overridden)
    const totalConcretePosts = (terminalPosts || chainLinkTerminalPosts || aluminumEndPosts || 2) + 
                                (cornerPosts || chainLinkCornerPosts || aluminumCornerPosts || 0) + 
                                (iBeamGatePosts || 0);
    const concreteBagsCalc = concreteBags > 0 ? concreteBags : (totalConcretePosts * 2);
    if (concreteBagsCalc > 0) {
        materials.push({
            lineItemName: '50lb Concrete Mix',
            quantity: concreteBagsCalc,
            unit: 'bags',
            calculationDetails: concreteBags > 0 ? 'Manual override' : `~2 bags per concrete post × ${totalConcretePosts} posts`
        });
    }

    return materials;
}