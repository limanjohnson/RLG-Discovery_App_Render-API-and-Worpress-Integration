jQuery(document).ready(function ($) {
    // Store last Bates output for use in Index tool
    var lastBatesOutput = null;
    var lastBatesFilename = null;

    // Tab switching functionality
    $('.rlg-tab').on('click', function () {
        var $this = $(this);
        var tabId = $this.data('tab');
        var $container = $this.closest('.rlg-discovery-tabs-container');

        // Update active tab button
        $container.find('.rlg-tab').removeClass('active');
        $this.addClass('active');

        // Update active pane
        $container.find('.rlg-tab-pane').removeClass('active');
        $container.find('#rlg-pane-' + tabId).addClass('active');
    });

    // Checkbox toggle for showing/hiding fields
    $('input[data-target]').on('change', function () {
        var targetId = $(this).data('target');
        var $target = $('#' + targetId);
        var $input = $target.find('input');

        if ($(this).is(':checked')) {
            $target.slideDown(200);
        } else {
            $target.slideUp(200);
            // Reset to 0 when unchecked so the API doesn't apply the effect
            $input.val(0);
        }
    });

    // Index source selector toggle
    $('input[name="index_source"]').on('change', function () {
        var source = $(this).val();
        var $uploadGroup = $('#index-upload-group');
        var $lastBatesInfo = $('#last-bates-info');

        if (source === 'last_bates') {
            $uploadGroup.slideUp(200);
            if (lastBatesOutput) {
                $lastBatesInfo.html('<span style="color:green;">✓ Last Bates output ready (' + lastBatesFilename + ')</span>').slideDown(200);
            } else {
                $lastBatesInfo.html('<span style="color:orange;">⚠ No Bates output yet. Run Bates Labeler first.</span>').slideDown(200);
            }
        } else {
            $uploadGroup.slideDown(200);
            $lastBatesInfo.slideUp(200);
        }
    });

    // Initialize Index source selector state
    if ($('input[name="index_source"]:checked').val() === 'last_bates') {
        $('#index-upload-group').hide();
        if (!lastBatesOutput) {
            $('#last-bates-info').html('<span style="color:orange;">⚠ No Bates output yet. Run Bates Labeler first.</span>').show();
        }
    }

    // Form submission handler
    $('.rlg-discovery-form').on('submit', function (e) {
        e.preventDefault();

        var $form = $(this);
        var $status = $form.find('.rlg-status');
        var $btn = $form.find('button[type="submit"]');

        var endpoint = $form.data('endpoint');
        var apiUrl = rlgSettings.apiUrl + endpoint;

        var formData = new FormData(this);

        // Special handling for Index form with "last_bates" source
        if (endpoint === '/index') {
            var source = $form.find('input[name="index_source"]:checked').val();
            if (source === 'last_bates') {
                if (!lastBatesOutput) {
                    $status.html('<span style="color:red;">No Bates output available. Please run Bates Labeler first or upload a ZIP.</span>');
                    return;
                }
                // Remove any uploaded file and add the stored blob
                formData.delete('file');
                formData.append('file', lastBatesOutput, lastBatesFilename);
            }
        }

        $status.html('Processing... <div class="rlg-spinner"></div>');
        $btn.prop('disabled', true);

        fetch(apiUrl, {
            method: 'POST',
            body: formData
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.blob();
            })
            .then(blob => {
                // Store Bates output for later use in Index
                if (endpoint === '/bates') {
                    lastBatesOutput = blob;
                    lastBatesFilename = 'bates_labeled.zip';
                    // Update the Index tool indicator if visible
                    if ($('input[name="index_source"][value="last_bates"]').is(':checked')) {
                        $('#last-bates-info').html('<span style="color:green;">✓ Last Bates output ready (' + lastBatesFilename + ')</span>');
                    }
                    // Show notification
                    $status.html('<span style="color:green;">Success! Download started.</span><br><small style="color:#666;">Output saved for Index tool.</small>');
                } else {
                    $status.html('<span style="color:green;">Success! Download started.</span>');
                }

                // Create download link
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;

                // Determine filename based on endpoint
                var filename = 'download.zip';
                if (endpoint === '/unlock') filename = 'unlocked_pdfs.zip';
                if (endpoint === '/organize') filename = 'organized_by_year.zip';
                if (endpoint === '/bates') filename = 'bates_labeled.zip';
                if (endpoint === '/redact') filename = 'redacted_output.zip';
                if (endpoint === '/index') filename = 'discovery_index.xlsx';

                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);

                $btn.prop('disabled', false);
            })
            .catch(error => {
                console.error('Error:', error);
                $status.html('<div style="color:red; background:#ffebeb; padding:10px; border:1px solid red; border-radius:4px;">' +
                    '<strong>Error:</strong> ' + error.message + '<br>' +
                    '<small>Attempted to connect to: ' + apiUrl + '</small><br>' +
                    '<small>Check console (F12) for details.</small>' +
                    '</div>');
                $btn.prop('disabled', false);
            });
    });
});
